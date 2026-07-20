import { describe, expect, it } from "vitest";
import {
  callProviderWithRetry,
  parseClassifyOutput,
  parseDraftOutput,
} from "./provider-output";
import {
  classifyRequest,
  classifyResponse,
  draftProviderOutput,
  TEST_NOW,
} from "./test-fixtures";

describe("provider output validation", () => {
  it("parse classify object hoặc JSON string", () => {
    expect(parseClassifyOutput(classifyResponse, classifyRequest)).toEqual(
      classifyResponse,
    );
    expect(
      parseClassifyOutput(JSON.stringify(classifyResponse), classifyRequest),
    ).toEqual(classifyResponse);
  });

  it("từ chối JSON bọc Markdown", () => {
    expect(() =>
      parseClassifyOutput(
        `\`\`\`json\n${JSON.stringify(classifyResponse)}\n\`\`\``,
        classifyRequest,
      ),
    ).toThrow();
  });

  it("parse draft và chỉ chấp nhận đúng hai field AI", () => {
    expect(
      parseDraftOutput(draftProviderOutput, TEST_NOW).draft.createdAt,
    ).toBe(TEST_NOW);
    expect(() =>
      parseDraftOutput(
        { draft: { ...draftProviderOutput.draft, extra: "no" } },
        TEST_NOW,
      ),
    ).toThrow();
  });

  it("retry truyền repairInstruction ở lần hai", async () => {
    const contexts: unknown[] = [];
    const result = await callProviderWithRetry(
      (context) => {
        contexts.push(context);
        return Promise.resolve(context.attempt === 1 ? "bad" : { ok: true });
      },
      (output) => {
        if (typeof output === "string") throw new Error("bad");
        return output;
      },
    );

    expect(result).toEqual({ ok: true });
    expect(contexts).toEqual([
      { attempt: 1, repairInstruction: undefined },
      {
        attempt: 2,
        repairInstruction: expect.stringContaining("khớp schema"),
      },
    ]);
  });
});
