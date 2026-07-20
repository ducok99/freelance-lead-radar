import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index";

describe("khung package @flr/api", () => {
  it("khai báo đúng tên package", () => {
    expect(PACKAGE_NAME).toBe("@flr/api");
  });
});
