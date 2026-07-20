import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "./anthropic";
import { classifyRequest, draftRequest } from "../test-fixtures";

const makeProvider = (fetcher: typeof fetch) =>
  new AnthropicProvider({
    apiKey: "test-provider-key",
    classifyModel: "test-classify-model",
    draftModel: "test-draft-model",
    fetcher,
    timeoutMs: 1_000,
  });

describe("AnthropicProvider", () => {
  it("gọi Messages API với model classify và trả text block", async () => {
    let capturedInit: RequestInit | undefined;
    let calls = 0;
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      capturedInit = init;
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: '{"results":[]}' }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    const provider = makeProvider(fetcher);

    await expect(
      provider.classify(classifyRequest, { attempt: 1 }),
    ).resolves.toBe('{"results":[]}');
    expect(calls).toBe(1);

    const body = JSON.parse(String(capturedInit?.body)) as Record<
      string,
      unknown
    >;
    expect(body.model).toBe("test-classify-model");
    expect(new Headers(capturedInit?.headers).get("x-api-key")).toBe(
      "test-provider-key",
    );
  });

  it("draft dùng model riêng", async () => {
    let requestedBody = "";
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestedBody = String(init?.body);
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: "draft-json" }] }),
        { status: 200 },
      );
    }) as typeof fetch;
    const provider = makeProvider(fetcher);

    await provider.draftComment(draftRequest, { attempt: 1 });
    expect(requestedBody).toContain('"model":"test-draft-model"');
    expect(requestedBody).toContain(draftRequest.teamProfile);
  });

  it("không echo response body khi Anthropic trả lỗi", async () => {
    const fetcher = (async () =>
      new Response("provider-secret-error-body", {
        status: 500,
      })) as typeof fetch;
    const provider = makeProvider(fetcher);
    await expect(
      provider.classify(classifyRequest, { attempt: 1 }),
    ).rejects.not.toThrow("provider-secret-error-body");
  });

  it.each([
    {},
    { content: [] },
    { content: [{ type: "tool_use", text: "no" }] },
  ])("từ chối response thiếu text block %#", async (payload) => {
    const fetcher = (async () =>
      new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
    await expect(
      makeProvider(fetcher).classify(classifyRequest, { attempt: 1 }),
    ).rejects.toThrow("Invalid Anthropic response");
  });
});
