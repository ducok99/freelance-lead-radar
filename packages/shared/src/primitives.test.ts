import { describe, expect, it } from "vitest";
import {
  ApiBaseUrlSchema,
  DateOnlySchema,
  FacebookGroupUrlSchema,
  FacebookPostUrlSchema,
  FacebookUrlSchema,
  IsoDateTimeSchema,
  NonNegativeIntegerSchema,
  PostKeySchema,
  ScoreSchema,
  UlidSchema,
} from "./index";
import { TEST_ULID } from "./test-fixtures";

describe("primitive schemas", () => {
  it("chấp nhận ULID hợp lệ", () => {
    expect(UlidSchema.parse(TEST_ULID)).toBe(TEST_ULID);
  });

  it("từ chối ULID sai độ dài", () => {
    expect(UlidSchema.safeParse("123").success).toBe(false);
  });

  it("từ chối ULID vượt miền timestamp 48-bit", () => {
    expect(UlidSchema.safeParse(`8${TEST_ULID.slice(1)}`).success).toBe(false);
    expect(UlidSchema.safeParse(`Z${TEST_ULID.slice(1)}`).success).toBe(false);
  });

  it("chấp nhận postKey groupId:postId", () => {
    expect(PostKeySchema.safeParse("group-1:post_2").success).toBe(true);
  });

  it("từ chối postKey không có dấu phân tách", () => {
    expect(PostKeySchema.safeParse("group-post").success).toBe(false);
  });

  it("từ chối postKey chứa ký tự điều khiển URL hoặc khoảng trắng", () => {
    expect(PostKeySchema.safeParse("group/1:post?2").success).toBe(false);
    expect(PostKeySchema.safeParse("group 1:post-2").success).toBe(false);
  });

  it("chấp nhận ISO datetime có offset", () => {
    expect(
      IsoDateTimeSchema.safeParse("2026-07-18T09:12:20+07:00").success,
    ).toBe(true);
  });

  it("từ chối datetime thiếu múi giờ", () => {
    expect(IsoDateTimeSchema.safeParse("2026-07-18T09:12:20").success).toBe(
      false,
    );
  });

  it("từ chối ngày không tồn tại", () => {
    expect(DateOnlySchema.safeParse("2026-02-30").success).toBe(false);
  });

  it("chỉ chấp nhận permalink HTTPS của www.facebook.com", () => {
    expect(
      FacebookUrlSchema.safeParse("https://www.facebook.com/groups/1/posts/2/")
        .success,
    ).toBe(true);
    expect(
      FacebookUrlSchema.safeParse("https://example.com/groups/1/posts/2/")
        .success,
    ).toBe(false);
  });

  it("phân biệt URL nhóm và permalink bài viết", () => {
    const groupUrl = "https://www.facebook.com/groups/freelancer-vietnam/";
    const postUrl = `${groupUrl}posts/123456789/`;
    expect(FacebookGroupUrlSchema.safeParse(groupUrl).success).toBe(true);
    expect(FacebookGroupUrlSchema.safeParse(postUrl).success).toBe(false);
    expect(FacebookPostUrlSchema.safeParse(postUrl).success).toBe(true);
    expect(FacebookPostUrlSchema.safeParse(groupUrl).success).toBe(false);
    expect(
      FacebookGroupUrlSchema.safeParse(
        "https://www.facebook.com/profile.php?id=123",
      ).success,
    ).toBe(false);
  });

  it("API URL chỉ cho phép Workers.dev và localhost HTTP", () => {
    expect(
      ApiBaseUrlSchema.safeParse("https://flr-api.example.workers.dev").success,
    ).toBe(true);
    expect(ApiBaseUrlSchema.safeParse("https://api.example.com").success).toBe(
      false,
    );
    expect(ApiBaseUrlSchema.safeParse("http://localhost:8787").success).toBe(
      true,
    );
    expect(ApiBaseUrlSchema.safeParse("http://api.example.com").success).toBe(
      false,
    );
  });

  it("score chỉ nằm trong 0 đến 100", () => {
    expect(ScoreSchema.safeParse(0).success).toBe(true);
    expect(ScoreSchema.safeParse(100).success).toBe(true);
    expect(ScoreSchema.safeParse(101).success).toBe(false);
    expect(ScoreSchema.safeParse(-1).success).toBe(false);
  });

  it("counter và số tiền không vượt quá số nguyên an toàn", () => {
    expect(
      NonNegativeIntegerSchema.safeParse(Number.MAX_SAFE_INTEGER).success,
    ).toBe(true);
    expect(
      NonNegativeIntegerSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success,
    ).toBe(false);
  });
});
