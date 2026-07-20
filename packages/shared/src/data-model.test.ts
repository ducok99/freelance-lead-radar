import { describe, expect, it } from "vitest";
import {
  BudgetSchema,
  CircuitBreakerSchema,
  ClassificationSchema,
  CounterStateSchema,
  DeadlineSchema,
  DedupeIndexSchema,
  ExtractionSchema,
  FilterReasonSchema,
  LeadSchema,
  LeadMapSchema,
  RawPostSchema,
  ScoreBreakdownSchema,
  SystemStateSchema,
} from "./index";
import {
  TEST_MEMBER_ULID,
  TEST_NOW,
  validExtraction,
  validLead,
  validRawPost,
  validScoreBreakdown,
} from "./test-fixtures";

describe("post và extraction schemas", () => {
  it("parse RawPost hợp lệ", () => {
    expect(RawPostSchema.parse(validRawPost).postKey).toBe(
      "1234567890:9876543210",
    );
  });

  it("từ chối postKey không khớp groupId", () => {
    expect(
      RawPostSchema.safeParse({ ...validRawPost, postKey: "999:9876543210" })
        .success,
    ).toBe(false);
  });

  it("từ chối permalink HTTP", () => {
    expect(
      RawPostSchema.safeParse({
        ...validRawPost,
        permalink: "http://www.facebook.com/groups/1/",
      }).success,
    ).toBe(false);
  });

  it("parse Extraction hợp lệ", () => {
    expect(ExtractionSchema.parse(validExtraction).field).toBe("video_editing");
  });

  it("từ chối ngân sách min lớn hơn max", () => {
    expect(
      BudgetSchema.safeParse({
        raw: "2-1 triệu",
        minVnd: 2_000_000,
        maxVnd: 1_000_000,
      }).success,
    ).toBe(false);
  });

  it("từ chối ngân sách vượt quá số nguyên an toàn", () => {
    expect(
      BudgetSchema.safeParse({
        raw: "quá lớn",
        minVnd: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false);
  });

  it("từ chối deadline không tồn tại", () => {
    expect(
      DeadlineSchema.safeParse({ raw: "30/2", date: "2026-02-30" }).success,
    ).toBe(false);
  });

  it("từ chối score breakdown vượt trọng số", () => {
    expect(
      ScoreBreakdownSchema.safeParse({ ...validScoreBreakdown, intent: 41 })
        .success,
    ).toBe(false);
  });

  it("từ chối công cụ và liên hệ bị trùng", () => {
    expect(
      ExtractionSchema.safeParse({
        ...validExtraction,
        tools: ["CapCut", "capcut"],
      }).success,
    ).toBe(false);
    expect(
      ExtractionSchema.safeParse({
        ...validExtraction,
        contacts: [
          { channel: "email", value: "Lead@Example.com" },
          { channel: "email", value: "lead@example.com" },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("LeadSchema", () => {
  it("parse và serialize lại Lead không mất dữ liệu", () => {
    const parsed = LeadSchema.parse(validLead);
    const reparsed = LeadSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed).toEqual(parsed);
  });

  it("từ chối confidence ngoài 0 đến 1", () => {
    expect(
      LeadSchema.safeParse({ ...validLead, confidence: 1.01 }).success,
    ).toBe(false);
  });

  it("từ chối score ngoài 0 đến 100", () => {
    expect(LeadSchema.safeParse({ ...validLead, score: -1 }).success).toBe(
      false,
    );
  });

  it("từ chối autoEligible khi score thấp", () => {
    expect(
      LeadSchema.safeParse({ ...validLead, autoEligible: true, score: 94 })
        .success,
    ).toBe(false);
  });

  it("từ chối autoEligible khi confidence thấp", () => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        autoEligible: true,
        score: 95,
        confidence: 0.84,
      }).success,
    ).toBe(false);
  });

  it("chấp nhận cờ autoEligible hợp lệ nhưng không tự hành động", () => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        autoEligible: true,
        score: 95,
        confidence: 0.95,
      }).success,
    ).toBe(true);
  });

  it("autoEligible chỉ dành cho bài thuê freelancer không bị lọc", () => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        autoEligible: true,
        score: 95,
        confidence: 0.95,
        classification: "seeking_work",
      }).success,
    ).toBe(false);
    expect(
      LeadSchema.safeParse({
        ...validLead,
        autoEligible: true,
        score: 95,
        confidence: 0.95,
        filterReasons: ["no_team_skill_match"],
      }).success,
    ).toBe(false);
  });

  it("filtered_out bắt buộc có filterReason", () => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        status: "filtered_out",
        filterReasons: [],
      }).success,
    ).toBe(false);
  });

  it("giữ status nhất quán với ngưỡng score", () => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        status: "below_threshold",
        score: 75,
      }).success,
    ).toBe(false);
    expect(
      LeadSchema.safeParse({
        ...validLead,
        status: "needs_review",
        score: 74,
      }).success,
    ).toBe(false);
  });

  it("updatedAt không được sớm hơn createdAt", () => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        createdAt: "2026-07-18T10:00:00+07:00",
        updatedAt: "2026-07-18T09:59:59+07:00",
      }).success,
    ).toBe(false);
  });

  it("trạng thái vòng đời yêu cầu metadata tương ứng", () => {
    expect(
      LeadSchema.safeParse({ ...validLead, status: "skipped" }).success,
    ).toBe(false);
    expect(
      LeadSchema.safeParse({ ...validLead, status: "approved" }).success,
    ).toBe(false);
    expect(
      LeadSchema.safeParse({
        ...validLead,
        status: "commented",
        approvedAt: TEST_NOW,
        finalComment: "Bình luận đã duyệt",
      }).success,
    ).toBe(false);
  });

  it("trạng thái kết quả phải có thành viên và outcome khớp", () => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        status: "won",
        approvedAt: TEST_NOW,
        outcome: null,
      }).success,
    ).toBe(false);
    expect(
      LeadSchema.safeParse({
        ...validLead,
        status: "won",
        approvedAt: TEST_NOW,
        assignedTo: TEST_MEMBER_ULID,
        outcome: "won",
      }).success,
    ).toBe(true);
  });

  it("labelNote yêu cầu label và LeadMap yêu cầu khóa khớp id", () => {
    expect(
      LeadSchema.safeParse({ ...validLead, labelNote: "Sai lĩnh vực" }).success,
    ).toBe(false);
    expect(
      LeadMapSchema.safeParse({ [TEST_MEMBER_ULID]: validLead }).success,
    ).toBe(false);
    expect(LeadMapSchema.safeParse({ [validLead.id]: validLead }).success).toBe(
      true,
    );
  });

  it("từ chối classification và filter reason không hợp lệ", () => {
    expect(ClassificationSchema.safeParse("job_offer").success).toBe(false);
    expect(FilterReasonSchema.safeParse("unknown_reason").success).toBe(false);
  });
});

describe("state schemas", () => {
  it("SystemState mặc định fail-safe", () => {
    expect(SystemStateSchema.parse({})).toEqual({
      emergencyStop: false,
      circuitBreaker: { state: "armed" },
      schemaVersion: 1,
    });
  });

  it("circuit breaker tripped cần lý do và thời gian", () => {
    expect(CircuitBreakerSchema.safeParse({ state: "tripped" }).success).toBe(
      false,
    );
    expect(
      CircuitBreakerSchema.safeParse({
        state: "tripped",
        reason: "checkpoint_detected",
        trippedAt: TEST_NOW,
      }).success,
    ).toBe(true);
  });

  it("CounterState từ chối failures lớn hơn attempts", () => {
    expect(
      CounterStateSchema.safeParse({
        date: "2026-07-18",
        extractionAttempts: 1,
        extractionFailures: 2,
      }).success,
    ).toBe(false);
  });

  it("DedupeIndex từ chối postKey không hợp lệ", () => {
    expect(
      DedupeIndexSchema.safeParse({
        "group/post": {
          decidedAt: TEST_NOW,
          terminal: true,
        },
      }).success,
    ).toBe(false);
  });
});
