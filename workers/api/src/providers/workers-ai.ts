import { type ClassifyRequest, type DraftRequest } from "@flr/shared";
import {
  buildClassifyPrompt,
  CLASSIFY_SYSTEM_PROMPT,
} from "../prompts/classify";
import { buildDraftPrompt, DRAFT_SYSTEM_PROMPT } from "../prompts/draft";
import type { AIProvider, ProviderAttemptContext } from "./types";

/**
 * P6.2 — Nhà cung cấp AI chạy trên Cloudflare Workers AI (bậc miễn phí
 * 10.000 neuron/ngày). Ưu điểm an toàn so với Anthropic: KHÔNG cần API key
 * bên thứ ba — model chạy ngay trong Worker qua binding `env.AI`, nên không
 * có secret AI nào phải lưu (SECURITY.md §6).
 *
 * Provider chỉ trả về text thô; parse JSON + retry + zod validate do
 * provider-output.ts đảm nhận, y như AnthropicProvider.
 */

/** Model mặc định — rẻ neuron, gần như không thể vượt bậc free ở quy mô MVP. */
export const DEFAULT_WORKERS_AI_CLASSIFY_MODEL =
  "@cf/meta/llama-3.1-8b-instruct-fp8";
/** Model soạn nháp: lớn hơn cho tiếng Việt tự nhiên, chạy ít lần/ngày. */
export const DEFAULT_WORKERS_AI_DRAFT_MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Hình dạng tối thiểu của kết quả text từ Workers AI. */
export interface WorkersAiTextResult {
  response?: string;
}

/**
 * Hình dạng tối thiểu của binding `env.AI` — khai báo cục bộ để test được và
 * không phải kéo `@cloudflare/workers-types` vào dependency production.
 */
export interface WorkersAiBinding {
  run(
    model: string,
    input: {
      messages: {
        role: "system" | "user" | "assistant";
        content: string;
      }[];
      max_tokens?: number;
      temperature?: number;
    },
  ): Promise<WorkersAiTextResult>;
}

export interface WorkersAiProviderOptions {
  ai: WorkersAiBinding;
  classifyModel: string;
  draftModel: string;
}

const readResponseText = (result: unknown): string => {
  if (typeof result !== "object" || result === null) {
    throw new Error("Invalid Workers AI response");
  }
  const response = Reflect.get(result, "response");
  if (typeof response !== "string" || response.trim().length === 0) {
    throw new Error("Invalid Workers AI response");
  }
  return response.trim();
};

export class WorkersAiProvider implements AIProvider {
  readonly #ai: WorkersAiBinding;
  readonly #classifyModel: string;
  readonly #draftModel: string;

  constructor(options: WorkersAiProviderOptions) {
    this.#ai = options.ai;
    this.#classifyModel = options.classifyModel;
    this.#draftModel = options.draftModel;
  }

  classify(
    request: ClassifyRequest,
    context: ProviderAttemptContext,
  ): Promise<unknown> {
    return this.#run(
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
    return this.#run(
      this.#draftModel,
      DRAFT_SYSTEM_PROMPT,
      buildDraftPrompt(request, context),
      1_024,
    );
  }

  async #run(
    model: string,
    system: string,
    prompt: string,
    maxTokens: number,
  ): Promise<string> {
    const result = await this.#ai.run(model, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0,
    });
    return readResponseText(result);
  }
}
