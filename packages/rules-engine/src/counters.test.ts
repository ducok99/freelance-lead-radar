import { CounterStateSchema, DEFAULT_SETTINGS } from "@flr/shared";
import { describe, expect, it } from "vitest";
import {
  canCallAi,
  canInsertComment,
  dateInTimeZone,
  recordAiCall,
  recordCommentInserted,
  rollCounters,
} from "./index";

const state = CounterStateSchema.parse({
  date: "2026-07-20",
  aiCalls: 3,
  commentsInserted: 2,
  extractionAttempts: 3,
});

describe("counter theo Asia/Bangkok", () => {
  it("đổi ngày đúng theo UTC+7", () => {
    expect(dateInTimeZone("2026-07-19T17:30:00Z")).toBe("2026-07-20");
  });
  it("chưa đổi ngày trước nửa đêm Bangkok", () => {
    expect(dateInTimeZone("2026-07-19T16:59:59Z")).toBe("2026-07-19");
  });
  it("reset toàn bộ counter khi sang ngày", () => {
    expect(rollCounters(state, "2026-07-21T00:00:00+07:00")).toMatchObject({
      date: "2026-07-21",
      aiCalls: 0,
      commentsInserted: 0,
    });
  });
  it("giữ nguyên object trong cùng ngày", () => {
    expect(rollCounters(state, "2026-07-20T12:00:00+07:00")).toBe(state);
  });
  it("từ chối thời gian sai", () => {
    expect(() => dateInTimeZone("not-a-date")).toThrow();
  });
});

describe("AI counters", () => {
  it("cho phép dưới limit", () => {
    expect(
      canCallAi(state, DEFAULT_SETTINGS.limits, "2026-07-20T12:00:00+07:00")
        .allowed,
    ).toBe(true);
  });
  it("chặn khi chạm limit", () => {
    const full = {
      ...state,
      aiCalls: DEFAULT_SETTINGS.limits.maxAiCallsPerDay,
    };
    expect(
      canCallAi(full, DEFAULT_SETTINGS.limits, "2026-07-20T12:00:00+07:00"),
    ).toMatchObject({ allowed: false, reason: "daily_limit_reached" });
  });
  it("ghi một lần gọi thành công", () => {
    expect(
      recordAiCall(state, "2026-07-20T12:00:00+07:00", true),
    ).toMatchObject({
      aiCalls: 4,
      extractionAttempts: 4,
      extractionFailures: 0,
    });
  });
  it("ghi extraction failure", () => {
    expect(
      recordAiCall(state, "2026-07-20T12:00:00+07:00", false)
        .extractionFailures,
    ).toBe(1);
  });
});

describe("comment counters", () => {
  it("chặn khi đủ 10 bình luận", () => {
    const full = { ...state, commentsInserted: 10 };
    expect(
      canInsertComment(
        full,
        DEFAULT_SETTINGS.limits,
        "2026-07-20T12:00:00+07:00",
      ),
    ).toMatchObject({ allowed: false, reason: "daily_limit_reached" });
  });
  it("chặn dưới khoảng cách 5 phút", () => {
    const recent = { ...state, lastCommentAt: "2026-07-20T11:58:00+07:00" };
    expect(
      canInsertComment(
        recent,
        DEFAULT_SETTINGS.limits,
        "2026-07-20T12:00:00+07:00",
      ),
    ).toMatchObject({ allowed: false, reason: "comment_interval_active" });
  });
  it("cho phép đúng mốc 5 phút", () => {
    const recent = { ...state, lastCommentAt: "2026-07-20T11:55:00+07:00" };
    expect(
      canInsertComment(
        recent,
        DEFAULT_SETTINGS.limits,
        "2026-07-20T12:00:00+07:00",
      ).allowed,
    ).toBe(true);
  });
  it("ghi bình luận và timestamp", () => {
    expect(
      recordCommentInserted(state, "2026-07-20T12:00:00+07:00"),
    ).toMatchObject({
      commentsInserted: 3,
      lastCommentAt: "2026-07-20T12:00:00+07:00",
    });
  });
});
