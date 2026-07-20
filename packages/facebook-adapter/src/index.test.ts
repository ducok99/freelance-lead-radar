import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index";

describe("khung package @flr/facebook-adapter", () => {
  it("khai báo đúng tên package", () => {
    expect(PACKAGE_NAME).toBe("@flr/facebook-adapter");
  });
});
