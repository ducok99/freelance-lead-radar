import {
  ApiErrorResponseSchema,
  API_MAX_PAYLOAD_BYTES,
  API_RATE_LIMIT_PER_MINUTE,
  ClassifyResponseSchema,
  DraftResponseSchema,
  HealthResponseSchema,
} from "@flr/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "./index";
import { MockProvider } from "./providers/mock";
import {
  classifyRequest,
  classifyResponse,
  draftProviderOutput,
  draftRequest,
  TEST_NOW,
  TEST_ORIGIN,
  TEST_TOKEN,
  testBindings,
} from "./test-fixtures";
import type { ApiLogEvent, ApiLogger } from "./types";

const silentLogger: ApiLogger = { log() {} };
const fixedNow = () => new Date(TEST_NOW);

const makeApp = (provider = new MockProvider()) => ({
  app: createApp({
    providerFactory: () => provider,
    logger: silentLogger,
    now: fixedNow,
  }),
  provider,
});

const postJson = (
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  overrides: {
    token?: string | null;
    origin?: string;
    contentType?: string;
  } = {},
) => {
  const headers = new Headers();
  if (overrides.token !== null) {
    headers.set("Authorization", `Bearer ${overrides.token ?? TEST_TOKEN}`);
  }
  headers.set("Content-Type", overrides.contentType ?? "application/json");
  headers.set("Origin", overrides.origin ?? TEST_ORIGIN);
  return app.request(
    path,
    { method: "POST", headers, body: JSON.stringify(body) },
    testBindings,
  );
};

describe("workers/api routes", () => {
  it("GET /v1/health không yêu cầu auth và đúng schema shared", async () => {
    const { app } = makeApp();
    const response = await app.request("/v1/health", undefined, testBindings);

    expect(response.status).toBe(200);
    expect(HealthResponseSchema.parse(await response.json())).toEqual({
      ok: true,
      schemaVersion: 1,
    });
  });

  it("classify bằng MockProvider, không cần key và đúng contract", async () => {
    const { app, provider } = makeApp();
    const response = await postJson(app, "/v1/classify", classifyRequest);

    expect(response.status).toBe(200);
    expect(
      ClassifyResponseSchema.parse(await response.json()).results,
    ).toHaveLength(1);
    expect(provider.classifyCalls).toBe(1);
  });

  it("draft bằng MockProvider và Worker tự gắn createdAt", async () => {
    const provider = new MockProvider({
      draftComment: () => draftProviderOutput,
    });
    const { app } = makeApp(provider);
    const response = await postJson(app, "/v1/draft", draftRequest);
    const body = DraftResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.draft.createdAt).toBe(TEST_NOW);
    expect(body.draft.aiText).toContain("TikTok");
    expect(provider.draftCalls).toBe(1);
  });

  it.each([
    ["thiếu token", null],
    ["token sai", "wrong-token"],
  ])("%s trả cùng lỗi 401", async (_label, token) => {
    const { app } = makeApp();
    const response = await postJson(app, "/v1/classify", classifyRequest, {
      token,
    });
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(401);
    expect(body.error).toMatchObject({
      code: "unauthorized",
      message: "Không được phép",
      retryable: false,
    });
  });

  it("auth chạy trước payload limit", async () => {
    const { app } = makeApp();
    const response = await postJson(
      app,
      "/v1/classify",
      { padding: "x".repeat(API_MAX_PAYLOAD_BYTES) },
      { token: null },
    );
    expect(response.status).toBe(401);
  });

  it("payload thực tế vượt 64KB trả 413", async () => {
    const { app } = makeApp();
    const response = await postJson(app, "/v1/classify", {
      padding: "x".repeat(API_MAX_PAYLOAD_BYTES),
    });
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("payload_too_large");
  });

  it("Content-Length khai báo vượt 64KB bị chặn trước khi đọc body", async () => {
    const { app } = makeApp();
    const response = await app.request(
      "/v1/classify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": String(API_MAX_PAYLOAD_BYTES + 1),
        },
        body: JSON.stringify(classifyRequest),
      },
      testBindings,
    );
    expect(response.status).toBe(413);
  });

  it("batch hơn 10 bài trả 400", async () => {
    const { app } = makeApp();
    const posts = Array.from({ length: 11 }, (_, index) => ({
      ...classifyRequest.posts[0]!,
      postKey: `1234567890:${index + 1}`,
    }));
    const response = await postJson(app, "/v1/classify", {
      ...classifyRequest,
      posts,
    });
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_request");
  });

  it("JSON hỏng trả 400 và không gọi provider", async () => {
    const { app, provider } = makeApp();
    const response = await app.request(
      "/v1/classify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: "{not-json",
      },
      testBindings,
    );

    expect(response.status).toBe(400);
    expect(provider.classifyCalls).toBe(0);
  });

  it("request có trường credential dư bị schema chặn", async () => {
    const { app, provider } = makeApp();
    const response = await postJson(app, "/v1/classify", {
      ...classifyRequest,
      facebookCookie: "credential-must-never-pass",
    });
    expect(response.status).toBe(400);
    expect(provider.classifyCalls).toBe(0);
  });

  it("content-type không phải JSON trả 400", async () => {
    const { app } = makeApp();
    const response = await postJson(app, "/v1/classify", classifyRequest, {
      contentType: "text/plain",
    });
    expect(response.status).toBe(400);
  });

  it("yêu cầu thứ 61 trong cùng phút trả 429", async () => {
    const { app } = makeApp();
    const responses = [];
    for (let index = 0; index <= API_RATE_LIMIT_PER_MINUTE; index += 1) {
      responses.push(await postJson(app, "/v1/classify", classifyRequest));
    }

    expect(responses.at(-2)?.status).toBe(200);
    expect(responses.at(-1)?.status).toBe(429);
    expect(
      ApiErrorResponseSchema.parse(await responses.at(-1)!.json()).error.code,
    ).toBe("rate_limited");
  });

  it("ưu tiên Cloudflare Rate Limiting binding và chỉ gửi token hash", async () => {
    const { app } = makeApp();
    const keys: string[] = [];
    const response = await app.request(
      "/v1/classify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(classifyRequest),
      },
      {
        ...testBindings,
        API_RATE_LIMITER: {
          limit: ({ key }) => {
            keys.push(key);
            return Promise.resolve({ success: false });
          },
        },
      },
    );

    expect(response.status).toBe(429);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toHaveLength(64);
    expect(keys[0]).not.toContain(TEST_TOKEN);
  });

  it("origin extension chính xác nhận CORS header", async () => {
    const { app } = makeApp();
    const response = await postJson(app, "/v1/classify", classifyRequest);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      TEST_ORIGIN,
    );
  });

  it("origin lạ không nhận CORS header", async () => {
    const { app } = makeApp();
    const response = await postJson(app, "/v1/classify", classifyRequest, {
      origin: "https://malicious.test",
    });
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("preflight chỉ chấp nhận đúng extension origin", async () => {
    const { app } = makeApp();
    const allowed = await app.request(
      "/v1/classify",
      { method: "OPTIONS", headers: { Origin: TEST_ORIGIN } },
      testBindings,
    );
    const denied = await app.request(
      "/v1/classify",
      { method: "OPTIONS", headers: { Origin: "https://malicious.test" } },
      testBindings,
    );

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      TEST_ORIGIN,
    );
    expect(denied.status).toBe(403);
  });

  it("AI JSON hỏng một lần thì retry và thành công", async () => {
    const provider = new MockProvider({
      classify: (_request, context) =>
        context.attempt === 1 ? "not-json" : classifyResponse,
    });
    const { app } = makeApp(provider);
    const response = await postJson(app, "/v1/classify", classifyRequest);

    expect(response.status).toBe(200);
    expect(provider.classifyCalls).toBe(2);
  });

  it("AI JSON hỏng hai lần trả 502 ai_unavailable", async () => {
    const provider = new MockProvider({ classify: () => "not-json" });
    const { app } = makeApp(provider);
    const response = await postJson(app, "/v1/classify", classifyRequest);
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(502);
    expect(body.error).toMatchObject({
      code: "ai_unavailable",
      retryable: true,
    });
    expect(provider.classifyCalls).toBe(2);
  });

  it("provider throw được retry đúng một lần rồi trả 502", async () => {
    const provider = new MockProvider({
      classify: () => {
        throw new Error("provider failed");
      },
    });
    const { app } = makeApp(provider);
    const response = await postJson(app, "/v1/classify", classifyRequest);
    expect(response.status).toBe(502);
    expect(provider.classifyCalls).toBe(2);
  });

  it("draft sai schema hai lần trả 502", async () => {
    const provider = new MockProvider({
      draftComment: () => ({ draft: { aiText: "thiếu rationale" } }),
    });
    const { app } = makeApp(provider);
    const response = await postJson(app, "/v1/draft", draftRequest);
    expect(response.status).toBe(502);
    expect(provider.draftCalls).toBe(2);
  });

  it("provider trả sai postKey cũng bị retry rồi 502", async () => {
    const provider = new MockProvider({
      classify: () => ({
        ...classifyResponse,
        results: [
          { ...classifyResponse.results[0]!, postKey: "1234567890:111" },
        ],
      }),
    });
    const { app } = makeApp(provider);
    const response = await postJson(app, "/v1/classify", classifyRequest);

    expect(response.status).toBe(502);
    expect(provider.classifyCalls).toBe(2);
  });

  it("không cấu hình Anthropic trả 502, không lộ tên secret", async () => {
    const app = createApp({ logger: silentLogger, now: fixedNow });
    const response = await app.request(
      "/v1/classify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
          Origin: TEST_ORIGIN,
        },
        body: JSON.stringify(classifyRequest),
      },
      { ...testBindings, AI_PROVIDER: "anthropic" },
    );
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain("ANTHROPIC_API_KEY");
  });

  it("TEAM_TOKEN server bị thiếu trả lỗi 500 chuẩn hóa", async () => {
    const { app } = makeApp();
    const response = await app.request(
      "/v1/classify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(classifyRequest),
      },
      { ...testBindings, TEAM_TOKEN: "" },
    );
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
  });

  it("logger chỉ nhận metadata, không nhận body hay token", async () => {
    const events: ApiLogEvent[] = [];
    const logger: ApiLogger = { log: (event) => events.push(event) };
    const app = createApp({
      providerFactory: () => new MockProvider(),
      logger,
      now: fixedNow,
    });
    await postJson(app, "/v1/classify", classifyRequest);

    expect(events).toHaveLength(1);
    expect(Object.keys(events[0]!).sort()).toEqual([
      "inputBytes",
      "latencyMs",
      "method",
      "route",
      "status",
      "timestamp",
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(TEST_TOKEN);
    expect(serialized).not.toContain(classifyRequest.posts[0]!.text);
  });

  it("endpoint lạ trả lỗi chuẩn hóa 404", async () => {
    const { app } = makeApp();
    const response = await app.request("/v1/missing", undefined, testBindings);
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("invalid_request");
  });
});
