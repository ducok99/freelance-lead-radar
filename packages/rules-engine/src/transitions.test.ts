import { LeadSchema, type LeadStatus } from "@flr/shared";
import { describe, expect, it } from "vitest";
import { TEST_MEMBER_ULID, validLead } from "../../shared/src/test-fixtures";
import {
  canTransition,
  InvalidLeadTransitionError,
  transitionLead,
  tryTransitionLead,
} from "./index";

const at = "2026-07-20T13:00:00+07:00";
const lead = LeadSchema.parse(validLead);

const allowed: Array<[LeadStatus, LeadStatus]> = [
  ["detected", "filtered_out"],
  ["detected", "below_threshold"],
  ["detected", "needs_review"],
  ["needs_review", "skipped"],
  ["needs_review", "approved"],
  ["approved", "comment_inserted"],
  ["approved", "assigned"],
  ["comment_inserted", "commented"],
  ["commented", "assigned"],
  ["assigned", "won"],
  ["assigned", "lost"],
];

const rejected: Array<[LeadStatus, LeadStatus]> = [
  ["needs_review", "commented"],
  ["approved", "won"],
  ["commented", "won"],
  ["assigned", "approved"],
  ["filtered_out", "needs_review"],
  ["below_threshold", "needs_review"],
  ["skipped", "approved"],
  ["won", "lost"],
  ["lost", "won"],
];

describe("bảng transition", () => {
  it.each(allowed)("cho phép %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });
  it.each(rejected)("từ chối %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("transitionLead", () => {
  it("needs_review -> approved thêm timestamp và audit", () => {
    const result = transitionLead(lead, "approved", { at });
    expect(result.lead).toMatchObject({
      status: "approved",
      approvedAt: at,
      updatedAt: at,
    });
    expect(result.audit).toMatchObject({
      action: "approved",
      detail: { from: "needs_review", to: "approved" },
    });
  });
  it("needs_review -> skipped thêm skippedAt", () => {
    expect(transitionLead(lead, "skipped", { at }).lead).toMatchObject({
      status: "skipped",
      skippedAt: at,
    });
  });
  it("comment_inserted cần finalComment", () => {
    const approved = transitionLead(lead, "approved", {
      at: "2026-07-20T12:00:00+07:00",
    }).lead;
    expect(() =>
      transitionLead(approved, "comment_inserted", { at }),
    ).toThrow();
    expect(
      transitionLead(approved, "comment_inserted", {
        at,
        finalComment: "Bình luận đã duyệt",
      }).lead.finalComment,
    ).toBe("Bình luận đã duyệt");
  });
  it("assigned cần member", () => {
    const approved = transitionLead(lead, "approved", {
      at: "2026-07-20T12:00:00+07:00",
    }).lead;
    expect(() => transitionLead(approved, "assigned", { at })).toThrow();
    expect(
      transitionLead(approved, "assigned", { at, assignedTo: TEST_MEMBER_ULID })
        .lead.assignedTo,
    ).toBe(TEST_MEMBER_ULID);
  });
  it("assigned -> won đặt outcome", () => {
    const assigned = LeadSchema.parse({
      ...lead,
      status: "assigned",
      approvedAt: "2026-07-20T11:00:00+07:00",
      assignedTo: TEST_MEMBER_ULID,
      updatedAt: "2026-07-20T12:00:00+07:00",
    });
    expect(transitionLead(assigned, "won", { at }).lead.outcome).toBe("won");
  });
  it("từ chối timestamp quay ngược", () => {
    expect(() =>
      transitionLead(lead, "approved", { at: "2026-07-18T08:00:00+07:00" }),
    ).toThrow();
  });
  it("từ chối timestamp sai định dạng bằng lỗi nghiệp vụ", () => {
    expect(() =>
      transitionLead(lead, "approved", { at: "not-a-date" }),
    ).toThrow(InvalidLeadTransitionError);
  });
  it("tryTransition trả lỗi cùng audit detail", () => {
    const result = tryTransitionLead(lead, "won", { at });
    expect(result).toMatchObject({
      ok: false,
      auditDetail: {
        from: "needs_review",
        to: "won",
        code: "invalid_transition",
      },
    });
  });
  it("không mutate lead gốc", () => {
    const before = JSON.stringify(lead);
    transitionLead(lead, "approved", { at });
    expect(JSON.stringify(lead)).toBe(before);
  });
  it("output luôn parse lại qua LeadSchema", () => {
    const result = transitionLead(lead, "approved", { at });
    expect(LeadSchema.safeParse(result.lead).success).toBe(true);
  });
  it("filtered_out cần filterReasons", () => {
    const detected = LeadSchema.parse({ ...lead, status: "detected" });
    expect(() => transitionLead(detected, "filtered_out", { at })).toThrow();
    expect(
      transitionLead(detected, "filtered_out", {
        at,
        filterReasons: ["poster_seeking_work"],
      }).lead.filterReasons,
    ).toEqual(["poster_seeking_work"]);
  });
  it("transition không thay đổi nội dung post", () => {
    const result = transitionLead(lead, "approved", { at });
    expect(result.lead.post).toEqual(lead.post);
  });
});
