import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "./anthropic";
import { createProvider } from "./index";
import { MockProvider } from "./mock";
import { classifyRequest, draftRequest, testBindings } from "../test-fixtures";

describe("provider factory và MockProvider", () => {
  it("local mock không cần Anthropic key", () => {
    expect(createProvider(testBindings)).toBeInstanceOf(MockProvider);
  });

  it("Anthropic yêu cầu đủ key và hai model", () => {
    expect(() =>
      createProvider({
        ...testBindings,
        AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "test-key",
        ANTHROPIC_CLASSIFY_MODEL: "classify-model",
        ANTHROPIC_DRAFT_MODEL: "draft-model",
      }),
    ).not.toThrow();

    expect(() =>
      createProvider({ ...testBindings, AI_PROVIDER: "anthropic" }),
    ).toThrow("Missing provider configuration");
  });

  it("factory Anthropic trả đúng implementation", () => {
    expect(
      createProvider({
        ...testBindings,
        AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "test-key",
        ANTHROPIC_CLASSIFY_MODEL: "classify-model",
        ANTHROPIC_DRAFT_MODEL: "draft-model",
      }),
    ).toBeInstanceOf(AnthropicProvider);
  });

  it("MockProvider mặc định trả classify và draft deterministic", async () => {
    const provider = new MockProvider();
    const classified = await provider.classify(classifyRequest, { attempt: 1 });
    const drafted = await provider.draftComment(draftRequest, { attempt: 1 });

    expect(classified).toMatchObject({
      results: [
        {
          postKey: classifyRequest.posts[0]!.postKey,
          classification: "hiring_freelancer",
        },
      ],
    });
    expect(drafted).toMatchObject({
      draft: { aiText: expect.stringContaining("portfolio") },
    });
  });
});
