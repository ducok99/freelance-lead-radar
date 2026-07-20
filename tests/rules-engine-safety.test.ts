import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import rulesEngineSafety from "../eslint.rules-engine.mjs";

describe("ESLint giữ rules-engine thuần", () => {
  const linter = new Linter();
  const globals = {
    languageOptions: {
      globals: {
        document: "readonly",
        fetch: "readonly",
        Math: "readonly",
      },
    },
  } as const;
  const lint = (code: string) =>
    linter.verify(code, [globals, ...rulesEngineSafety], {
      filename: "packages/rules-engine/src/probe.ts",
    });

  it("chặn DOM", () => {
    expect(lint('document.querySelector("article")')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "no-restricted-globals" }),
      ]),
    );
  });

  it("chặn fetch", () => {
    expect(lint('fetch("https://example.com")')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "no-restricted-globals" }),
      ]),
    );
  });

  it("chặn Math.random", () => {
    expect(lint("Math.random()")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "no-restricted-properties" }),
      ]),
    );
  });

  it("cho phép hàm thuần", () => {
    expect(lint("const score = Math.min(100, 80 + 10)")).toHaveLength(0);
  });
});
