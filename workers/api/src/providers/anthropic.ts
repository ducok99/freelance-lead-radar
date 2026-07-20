import {
  API_PROVIDER_TIMEOUT_MS,
  type ClassifyRequest,
  type DraftRequest,
} from "@flr/shared";
import {
  buildClassifyPrompt,
  CLASSIFY_SYSTEM_PROMPT,
} from "../prompts/classify";
import { buildDraftPrompt, DRAFT_SYSTEM_PROMPT } from "../prompts/draft";
import type { AIProvider, ProviderAttemptContext } from "./types";

export interface AnthropicProviderOptions {
  apiKey: string;
  classifyModel: string;
  draftModel: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const readTextContent = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid Anthropic response");
  }
  const content = Reflect.get(payload, "content");
  if (!Array.isArray(content)) {
    throw new Error("Invalid Anthropic response");
  }

  const text = content
    .filter(
      (block): block is { type: "text"; text: string } =>
        typeof block === "object" &&
        block !== null &&
        Reflect.get(block, "type") === "text" &&
        typeof Reflect.get(block, "text") === "string",
    )
    .map((block) => block.text)
    .join("")
    .trim();

  if (text.length === 0) {
    throw new Error("Invalid Anthropic response");
  }
  return text;
};

export class AnthropicProvider implements AIProvider {
  readonly #apiKey: string;
  readonly #classifyModel: string;
  readonly #draftModel: string;
  readonly #fetcher: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: AnthropicProviderOptions) {
    this.#apiKey = options.apiKey;
    this.#classifyModel = options.classifyModel;
    this.#draftModel = options.draftModel;
    this.#fetcher = options.fetcher ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? API_PROVIDER_TIMEOUT_MS;
  }

  classify(
    request: ClassifyRequest,
    context: ProviderAttemptContext,
  ): Promise<unknown> {
    return this.#request(
      this.#classifyModel,
      CLASSIFY_SYSTEM_PROMPT,
      buildClassifyPrompt(request, context),
      4_096,
    );
  }

  draftComment(
    request: DraftRequest,
    context: ProviderAttemptContext,
  ): Promise<unknown> {
    return this.#request(
      this.#draftModel,
      DRAFT_SYSTEM_PROMPT,
      buildDraftPrompt(request, context),
      1_024,
    );
  }

  async #request(
    model: string,
    system: string,
    prompt: string,
    maxTokens: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "x-api-key": this.#apiKey,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0,
            system,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error("Anthropic request failed");
      }
      return readTextContent(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }
}
