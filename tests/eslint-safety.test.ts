import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import safety from "../eslint.safety.mjs";

/**
 * IMPLEMENTATION-PLAN.md P0 AC: rule cấm document.cookie và eval phải
 * thực sự hoạt động. Test dùng ĐÚNG fragment cấu hình mà eslint.config.mjs
 * sử dụng (eslint.safety.mjs) để không bao giờ lệch nhau.
 */
describe("eslint.safety.mjs — bất biến an toàn (SECURITY.md §3)", () => {
  const linter = new Linter();

  // Khai báo globals của môi trường trình duyệt cho snippet test —
  // rule scope-aware như no-implied-eval cần biết setTimeout là global thật.
  const browserGlobals = {
    languageOptions: {
      globals: { setTimeout: "readonly", document: "readonly" },
    },
  } as const;

  const lint = (code: string) =>
    linter.verify(code, [browserGlobals, ...safety], {
      filename: "snippet.js",
    });

  it("chặn đọc document.cookie (bất biến #1)", () => {
    const messages = lint("const c = document.cookie;");
    expect(messages.some((m) => m.ruleId === "no-restricted-properties")).toBe(
      true,
    );
  });

  it("chặn ghi document.cookie (bất biến #1)", () => {
    const messages = lint('document.cookie = "x=1";');
    expect(messages.some((m) => m.ruleId === "no-restricted-properties")).toBe(
      true,
    );
  });

  it("chặn eval", () => {
    const messages = lint('eval("1 + 1");');
    expect(messages.some((m) => m.ruleId === "no-eval")).toBe(true);
  });

  it("chặn implied eval (setTimeout với chuỗi)", () => {
    const messages = lint('setTimeout("doWork()", 100);');
    expect(messages.some((m) => m.ruleId === "no-implied-eval")).toBe(true);
  });

  it("không báo lỗi với code sạch", () => {
    const messages = lint("const a = 1 + 1;\nconsole.log(a);");
    expect(messages.filter((m) => m.severity === 2)).toHaveLength(0);
  });
});
