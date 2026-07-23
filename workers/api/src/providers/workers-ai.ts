import { type ClassifyRequest, type DraftRequest } from "@flr/shared";
import {
  buildClassifyPrompt,
  CLASSIFY_SYSTEM_PROMPT,
} from "../prompts/classify";
import { buildDraftPrompt, DRAFT_SYSTEM_PROMPT } from "../prompts/draft";
import { CLASSIFY_JSON_SCHEMA, DRAFT_JSON_SCHEMA } from "./response-schema";
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

// P6.14 — Model mặc định phải là biến thể CÓ hỗ trợ JSON Mode (response_format).
// Biến thể `-fp8` KHÔNG nằm trong danh sách hỗ trợ JSON Mode của Cloudflare, nên
// đổi sang `-fast`: vẫn 8B (rẻ neuron), có JSON Mode, và nhanh hơn (giảm độ trễ
// từng gây timeout ở P6.13). Xem docs Workers AI › Features › JSON Mode.
/** Model mặc định — rẻ neuron, hỗ trợ JSON Mode, nhanh. */
export const DEFAULT_WORKERS_AI_CLASSIFY_MODEL =
  "@cf/meta/llama-3.1-8b-instruct-fast";
/** Model soạn nháp: 70B fp8-fast cho tiếng Việt tự nhiên, có hỗ trợ JSON Mode. */
export const DEFAULT_WORKERS_AI_DRAFT_MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * Hình dạng tối thiểu của kết quả từ Workers AI.
 * `response` là chuỗi ở chế độ text thường, nhưng là OBJECT JSON đã parse khi
 * bật JSON Mode (response_format) — nên để `unknown`, xử lý cả hai ở readResponse.
 */
export interface WorkersAiTextResult {
  response?: unknown;
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
      // P6.14 — JSON Mode: ép model trả đúng khung JSON đã khai báo.
      response_format?: {
        type: "json_schema";
        json_schema: unknown;
      };
    },
  ): Promise<WorkersAiTextResult>;
}

export interface WorkersAiProviderOptions {
  ai: WorkersAiBinding;
  classifyModel: string;
  draftModel: string;
}

// P6.15 — Đọc kết quả Workers AI, chấp nhận CẢ HAI dạng:
//  - Chế độ text thường: `response` là CHUỖI JSON → trả chuỗi (đã trim).
//  - JSON Mode (response_format): `response` là OBJECT JSON đã parse → trả
//    nguyên object. parseJsonValue ở provider-output.ts nhận cả string lẫn
//    object nên phía sau không cần đổi. Trước P6.15 hàm này bắt buộc chuỗi nên
//    ném "Invalid Workers AI response" cho mọi phản hồi JSON Mode → 502.
const readResponse = (result: unknown): unknown => {
  if (typeof result !== "object" || result === null) {
    throw new Error("Invalid Workers AI response");
  }
  const response = Reflect.get(result, "response");
  if (typeof response === "string") {
    if (response.trim().length === 0) {
      throw new Error("Invalid Workers AI response");
    }
    return response.trim();
  }
  if (typeof response === "object" && response !== null) {
    return response;
  }
  throw new Error("Invalid Workers AI response");
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
      CLASSIFY_JSON_SCHEMA,
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
      DRAFT_JSON_SCHEMA,
    );
  }

  async #run(
    model: string,
    system: string,
    prompt: string,
    maxTokens: number,
    jsonSchema: unknown,
  ): Promise<unknown> {
    const result = await this.#ai.run(model, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0,
      // P6.14 — bật JSON Mode để model trả đúng khung; Zod vẫn kiểm tra cuối.
      response_format: { type: "json_schema", json_schema: jsonSchema },
    });
    return readResponse(result);
  }
}
