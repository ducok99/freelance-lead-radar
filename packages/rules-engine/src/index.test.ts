import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index";

describe("khung package @flr/rules-engine", () => {
  it("khai báo đúng tên package", () => {
    expect(PACKAGE_NAME).toBe("@flr/rules-engine");
  });
});
