import { describe, expect, it } from "vitest";
import {
  ApiErrorResponseSchema,
  ClassifyRequestSchema,
  ClassifyResponseSchema,
  DraftRequestSchema,
  ExtensionMessageSchema,
  HealthResponseSchema,
} from "./index";
import {
  TEST_MEMBER_ULID,
  TEST_NOW,
  validExtraction,
  validRawPost,
  validScoreBreakdown,
} from "./test-fixtures";

const postInput = {
  postKey: validRawPost.postKey,
  anonymousPoster: validRawPost.anonymousPoster,
  text: validRawPost.text,
  truncated: validRawPost.truncated,
  postedAtText: validRawPost.postedAtText,
};

const classifyResult = {
  postKey: validRawPost.postKey,
  classification: "hiring_freelancer" as const,
  confidence: 0.93,
  scoreBreakdown: validScoreBreakdown,
  extraction: validExtraction,
};

describe("API contract schemas", () => {
  it("parse classify request hợp lệ", () => {
    expect(
      ClassifyRequestSchema.safeParse({
        posts: [postInput],
        teamSkills: ["video_editing"],
      }).success,
    ).toBe(true);
  });

  it("giới hạn classify batch tối đa 10 bài", () => {
    expect(
      ClassifyRequestSchema.safeParse({
        posts: Array.from({ length: 11 }, (_, index) => ({
          ...postInput,
          postKey: `1234567890:${index + 1}`,
        })),
        teamSkills: ["video_editing"],
      }).success,
    ).toBe(false);
  });

  it("API request từ chối credential và trường dư", () => {
    expect(
      ClassifyRequestSchema.safeParse({
        posts: [postInput],
        teamSkills: ["video_editing"],
        facebookCookie: "c_user=1",
      }).success,
    ).toBe(false);
  });

  it("API classify chỉ nhận dữ liệu bài viết tối thiểu", () => {
    expect(
      ClassifyRequestSchema.safeParse({
        posts: [{ ...postInput, groupId: validRawPost.groupId }],
        teamSkills: ["video_editing"],
      }).success,
    ).toBe(false);
    expect(
      ClassifyRequestSchema.safeParse({
        posts: [{ ...postInput, permalink: validRawPost.permalink }],
        teamSkills: ["video_editing"],
      }).success,
    ).toBe(false);
  });

  it("từ chối postKey và team skill trùng trong request", () => {
    expect(
      ClassifyRequestSchema.safeParse({
        posts: [postInput, postInput],
        teamSkills: ["video_editing"],
      }).success,
    ).toBe(false);
    expect(
      ClassifyRequestSchema.safeParse({
        posts: [postInput],
        teamSkills: ["video_editing", "video_editing"],
      }).success,
    ).toBe(false);
  });

  it("parse classify response hợp lệ", () => {
    expect(
      ClassifyResponseSchema.safeParse({
        results: [classifyResult],
      }).success,
    ).toBe(true);
  });

  it("classify response không được rỗng hoặc trùng postKey", () => {
    expect(ClassifyResponseSchema.safeParse({ results: [] }).success).toBe(
      false,
    );
    expect(
      ClassifyResponseSchema.safeParse({
        results: [classifyResult, classifyResult],
      }).success,
    ).toBe(false);
  });

  it("parse draft request hợp lệ", () => {
    expect(
      DraftRequestSchema.safeParse({
        postKey: validRawPost.postKey,
        postText: validRawPost.text,
        extraction: validExtraction,
        score: 88,
        teamProfile: "Team chuyên dựng và biên tập video ngắn.",
      }).success,
    ).toBe(true);
  });

  it("health response tự thêm schemaVersion", () => {
    expect(HealthResponseSchema.parse({ ok: true })).toEqual({
      ok: true,
      schemaVersion: 1,
    });
  });

  it("parse API error chuẩn hóa", () => {
    expect(
      ApiErrorResponseSchema.safeParse({
        error: {
          code: "ai_unavailable",
          message: "AI tạm thời không khả dụng",
          retryable: true,
        },
      }).success,
    ).toBe(true);
  });
});

describe("typed extension messages", () => {
  it.each([
    { type: "GET_GATE_STATE" },
    { type: "SET_EMERGENCY_STOP", enabled: true },
    { type: "RESET_CIRCUIT_BREAKER" },
    {
      type: "WARNING_DETECTED",
      reason: "captcha_detected",
      detectedAt: TEST_NOW,
    },
    {
      type: "INSERT_COMMENT",
      leadId: TEST_MEMBER_ULID,
      postKey: validRawPost.postKey,
      text: "Bình luận đã được người dùng duyệt.",
    },
  ])("chấp nhận message $type", (message) => {
    expect(ExtensionMessageSchema.safeParse(message).success).toBe(true);
  });

  it("từ chối message không xác định", () => {
    expect(
      ExtensionMessageSchema.safeParse({ type: "AUTO_SUBMIT_COMMENT" }).success,
    ).toBe(false);
  });

  it("từ chối INSERT_COMMENT thiếu nội dung", () => {
    expect(
      ExtensionMessageSchema.safeParse({
        type: "INSERT_COMMENT",
        leadId: TEST_MEMBER_ULID,
        postKey: validRawPost.postKey,
        text: "",
      }).success,
    ).toBe(false);
  });
});
