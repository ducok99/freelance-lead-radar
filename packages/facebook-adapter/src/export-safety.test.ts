import { describe, expect, it } from "vitest";
import * as adapter from "./index";
import { SELECTORS } from "./selectors";

describe("export surface an toàn", () => {
  it("chỉ export allowlist chỉ-đọc đã duyệt", () => {
    expect(Object.keys(adapter).sort()).toEqual([
      "SELECTORS",
      "detectWarningSignals",
      "extractPost",
      "findCommentBox",
      "findPostElements",
      "isExtractionFailure",
      "parsePostKey",
      "parsePostReference",
    ]);
  });

  it("P3 chỉ locator ô bình luận, chưa có fillCommentBox", () => {
    expect(Object.keys(adapter)).not.toContain("fillCommentBox");
  });

  it("selector không dùng class obfuscated", () => {
    expect(JSON.stringify(SELECTORS)).not.toMatch(/\.[A-Za-z0-9_-]{4,}/);
  });
});
