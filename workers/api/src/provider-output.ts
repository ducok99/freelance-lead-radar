import {
  ClassifyResponseSchema,
  DraftResponseSchema,
  type ClassifyRequest,
  type ClassifyResponse,
  type DraftResponse,
} from "@flr/shared";
import { aiUnavailable } from "./errors";
import type { ProviderAttemptContext } from "./providers/types";

const parseJsonValue = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  return JSON.parse(value) as unknown;
};

const samePostKeys = (
  request: ClassifyRequest,
  response: ClassifyResponse,
): boolean => {
  if (request.posts.length !== response.results.length) return false;
  const requested = new Set(request.posts.map((post) => post.postKey));
  return response.results.every((result) => requested.has(result.postKey));
};

export const parseClassifyOutput = (
  output: unknown,
  request: ClassifyRequest,
): ClassifyResponse => {
  const response = ClassifyResponseSchema.parse(parseJsonValue(output));
  if (!samePostKeys(request, response)) {
    throw new Error("Provider returned mismatched post keys");
  }
  return response;
};

const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    [...expected].sort().every((key, index) => actual[index] === key)
  );
};

export const parseDraftOutput = (
  output: unknown,
  createdAt: string,
): DraftResponse => {
  const parsed = parseJsonValue(output);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !hasExactKeys(parsed as Record<string, unknown>, ["draft"])
  ) {
    throw new Error("Provider returned invalid draft object");
  }

  const draft = Reflect.get(parsed, "draft");
  if (
    typeof draft !== "object" ||
    draft === null ||
    !hasExactKeys(draft as Record<string, unknown>, ["aiText", "rationale"])
  ) {
    throw new Error("Provider returned invalid draft fields");
  }

  return DraftResponseSchema.parse({
    draft: {
      aiText: Reflect.get(draft, "aiText"),
      rationale: Reflect.get(draft, "rationale"),
      createdAt,
    },
  });
};

export const callProviderWithRetry = async <T>(
  call: (context: ProviderAttemptContext) => Promise<unknown>,
  parse: (output: unknown) => T,
): Promise<T> => {
  let repairInstruction: string | undefined;

  for (const attempt of [1, 2] as const) {
    try {
      const output = await call({ attempt, repairInstruction });
      return parse(output);
    } catch (error) {
      // P6.15 — ghi lý do thật của lần gọi AI thất bại để soi qua `wrangler
      // tail` (trước đây catch để trống nên 502 không kèm nguyên nhân). Chỉ log
      // thông điệp lỗi, KHÔNG log nội dung bài, để tránh lộ dữ liệu người dùng.
      console.error(
        `[FLR] AI attempt ${String(attempt)} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      repairInstruction =
        "JSON trước không khớp schema. Trả lại đúng object JSON, đủ trường, không Markdown.";
    }
  }

  throw aiUnavailable();
};
