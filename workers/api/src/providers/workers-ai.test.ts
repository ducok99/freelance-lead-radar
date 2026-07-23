import { describe, expect, it, vi } from "vitest";
import { createProvider } from "./index";
import {
  DEFAULT_WORKERS_AI_CLASSIFY_MODEL,
  DEFAULT_WORKERS_AI_DRAFT_MODEL,
  WorkersAiProvider,
  type WorkersAiBinding,
} from "./workers-ai";
import { classifyRequest, draftRequest, testBindings } from "../test-fixtures";

const okResult = { response: '{"ok":"data"}' };

const makeBinding = (
  result: unknown = okResult,
): WorkersAiBinding & { calls: { model: string; input: unknown }[] } => {
  const calls: { model: string; input: unknown }[] = [];
  return {
    calls,
    run: vi.fn((model: string, input: unknown) => {
      calls.push({ model, input });
      return Promise.resolve(result as { response?: string });
    }),
  };
};

describe("P6.2 WorkersAiProvider", () => {
  it("classify gọi đúng model + kèm system và user message, trả text thô", async () => {
    const ai = makeBinding();
    const provider = new WorkersAiProvider({
      ai,
      classifyModel: "@cf/test/classify",
      draftModel: "@cf/test/draft",
    });

    const output = await provider.classify(classifyRequest, { attempt: 1 });

    expect(output).toBe('{"ok":"data"}');
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]?.model).toBe("@cf/test/classify");
    const input = ai.calls[0]?.input as {
      messages: { role: string }[];
      temperature: number;
    };
    expect(input.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(input.temperature).toBe(0);
  });

  it("draft dùng draftModel", async () => {
    const ai = makeBinding();
    const provider = new WorkersAiProvider({
      ai,
      classifyModel: "@cf/test/classify",
      draftModel: "@cf/test/draft",
    });

    await provider.draftComment(draftRequest, { attempt: 1 });
    expect(ai.calls[0]?.model).toBe("@cf/test/draft");
  });

  it("P6.14 bật JSON Mode (response_format json_schema) cho cả classify và draft", async () => {
    const ai = makeBinding();
    const provider = new WorkersAiProvider({
      ai,
      classifyModel: "@cf/test/classify",
      draftModel: "@cf/test/draft",
    });

    await provider.classify(classifyRequest, { attempt: 1 });
    await provider.draftComment(draftRequest, { attempt: 1 });

    const responseFormatOf = (index: number) =>
      (
        ai.calls[index]?.input as {
          response_format?: { type?: string; json_schema?: unknown };
        }
      ).response_format;

    // classify: khung có mảng results bắt buộc.
    const classifyFormat = responseFormatOf(0);
    expect(classifyFormat?.type).toBe("json_schema");
    expect(
      (classifyFormat?.json_schema as { required?: string[] }).required,
    ).toContain("results");

    // draft: khung có object draft bắt buộc.
    const draftFormat = responseFormatOf(1);
    expect(draftFormat?.type).toBe("json_schema");
    expect(
      (draftFormat?.json_schema as { required?: string[] }).required,
    ).toContain("draft");
  });

  it("phản hồi thiếu trường response → coi là lỗi để retry/502 xử lý tiếp", async () => {
    const provider = new WorkersAiProvider({
      ai: makeBinding({ notResponse: true }),
      classifyModel: "@cf/test/classify",
      draftModel: "@cf/test/draft",
    });

    await expect(
      provider.classify(classifyRequest, { attempt: 1 }),
    ).rejects.toThrow("Invalid Workers AI response");
  });

  it("P6.15 JSON Mode trả `response` là OBJECT đã parse → giữ nguyên object", async () => {
    // Cloudflare trả object (không phải chuỗi) khi bật response_format. Provider
    // phải chuyển tiếp nguyên object cho provider-output parse, không được ném lỗi.
    const objectResult = { response: { results: [{ postKey: "g:1" }] } };
    const provider = new WorkersAiProvider({
      ai: makeBinding(objectResult),
      classifyModel: "@cf/test/classify",
      draftModel: "@cf/test/draft",
    });

    const output = await provider.classify(classifyRequest, { attempt: 1 });
    expect(output).toEqual({ results: [{ postKey: "g:1" }] });
  });
});

describe("P6.2 createProvider — nhánh workers_ai", () => {
  const aiBindings = {
    ...testBindings,
    AI_PROVIDER: "workers_ai" as const,
    AI: makeBinding(),
  };

  it("trả WorkersAiProvider khi có binding AI", () => {
    expect(createProvider(aiBindings)).toBeInstanceOf(WorkersAiProvider);
  });

  it("thiếu binding AI → báo lỗi cấu hình (→ 502 ai_unavailable)", () => {
    const { AI: _omitted, ...withoutAi } = aiBindings;
    void _omitted;
    expect(() => createProvider(withoutAi)).toThrow(
      "Missing provider configuration: AI binding",
    );
  });

  it("không cần API key nào — đây là điểm an toàn của Workers AI", () => {
    expect(aiBindings).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(() => createProvider(aiBindings)).not.toThrow();
  });

  it("model mặc định rẻ-neuron được dùng khi không cấu hình model", () => {
    // Không set WORKERS_AI_*_MODEL → provider dùng hằng số mặc định.
    expect(DEFAULT_WORKERS_AI_CLASSIFY_MODEL).toContain("llama-3.1-8b");
    expect(DEFAULT_WORKERS_AI_DRAFT_MODEL).toContain("llama-3.3-70b");
    expect(createProvider(aiBindings)).toBeInstanceOf(WorkersAiProvider);
  });
});
