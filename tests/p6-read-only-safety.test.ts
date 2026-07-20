import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "apps", "extension", "src");

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });

const runtimeSource = sourceFiles(sourceRoot)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

describe("P6 runtime chỉ đọc", () => {
  it("không có DOM API click hoặc submit", () => {
    expect(runtimeSource).not.toMatch(/\.click\s*\(/);
    expect(runtimeSource).not.toMatch(/\.submit\s*\(/);
    expect(runtimeSource).not.toMatch(/\.requestSubmit\s*\(/);
  });

  it("background chưa xử lý hợp đồng ghi bình luận của P7", () => {
    expect(runtimeSource).not.toMatch(
      /message\.type\s*===\s*["']INSERT_COMMENT["']/,
    );
    expect(runtimeSource).not.toMatch(
      /message\.type\s*===\s*["']COMMENT_CONFIRMED["']/,
    );
  });

  it("không dùng automation API để tạo sự kiện ghi giả", () => {
    expect(runtimeSource).not.toMatch(/dispatchEvent\s*\(/);
    expect(runtimeSource).not.toMatch(/execCommand\s*\(/);
  });
});
