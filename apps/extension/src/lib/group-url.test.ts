import { describe, expect, it } from "vitest";
import { createGroupRef, extractGroupId, normalizeGroupUrl } from "./group-url";

describe("Facebook group URL", () => {
  it("chuẩn hóa URL nhóm và bỏ query", () => {
    expect(
      normalizeGroupUrl(
        "https://www.facebook.com/groups/freelancer.vn/?ref=share",
      ),
    ).toBe("https://www.facebook.com/groups/freelancer.vn");
    expect(
      extractGroupId("https://www.facebook.com/groups/123456/posts/99"),
    ).toBe("123456");
  });

  it("từ chối host/protocol/path lạ", () => {
    expect(extractGroupId("http://www.facebook.com/groups/123")).toBeNull();
    expect(extractGroupId("https://m.facebook.com/groups/123")).toBeNull();
    expect(extractGroupId("https://www.facebook.com/marketplace")).toBeNull();
  });

  it("tạo GroupRef đã validate", () => {
    expect(
      createGroupRef(
        "Freelancer test",
        "https://www.facebook.com/groups/123456/",
      ),
    ).toEqual({
      groupId: "123456",
      name: "Freelancer test",
      url: "https://www.facebook.com/groups/123456",
      active: true,
    });
  });
});
