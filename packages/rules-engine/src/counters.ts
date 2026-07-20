import {
  CounterStateSchema,
  DEFAULT_TIME_ZONE,
  SCHEMA_VERSION,
  type CounterState,
  type Limits,
} from "@flr/shared";

export type CounterBlockReason =
  "daily_limit_reached" | "comment_interval_active";

export interface CounterDecision {
  allowed: boolean;
  state: CounterState;
  reason?: CounterBlockReason;
}

const toDate = (value: string | Date): Date => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime()))
    throw new Error("Thời gian không hợp lệ");
  return date;
};

export const dateInTimeZone = (
  value: string | Date,
  timeZone = DEFAULT_TIME_ZONE,
): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDate(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("Không thể xác định ngày theo múi giờ");
  }
  return `${year}-${month}-${day}`;
};

export const rollCounters = (
  state: CounterState,
  now: string | Date,
): CounterState => {
  const date = dateInTimeZone(now);
  if (state.date === date) return state;
  return CounterStateSchema.parse({ date, schemaVersion: SCHEMA_VERSION });
};

export const canCallAi = (
  state: CounterState,
  limits: Limits,
  now: string | Date,
): CounterDecision => {
  const current = rollCounters(state, now);
  return current.aiCalls >= limits.maxAiCallsPerDay
    ? { allowed: false, state: current, reason: "daily_limit_reached" }
    : { allowed: true, state: current };
};

export const recordAiCall = (
  state: CounterState,
  now: string | Date,
  extractionSucceeded: boolean,
): CounterState => {
  const current = rollCounters(state, now);
  return CounterStateSchema.parse({
    ...current,
    aiCalls: current.aiCalls + 1,
    extractionAttempts: current.extractionAttempts + 1,
    extractionFailures:
      current.extractionFailures + (extractionSucceeded ? 0 : 1),
  });
};

export const recordDraftCall = (
  state: CounterState,
  now: string | Date,
): CounterState => {
  const current = rollCounters(state, now);
  return CounterStateSchema.parse({
    ...current,
    aiCalls: current.aiCalls + 1,
  });
};

export const canInsertComment = (
  state: CounterState,
  limits: Limits,
  now: string | Date,
): CounterDecision => {
  const current = rollCounters(state, now);
  if (current.commentsInserted >= limits.maxCommentsPerDay) {
    return {
      allowed: false,
      state: current,
      reason: "daily_limit_reached",
    };
  }
  if (current.lastCommentAt !== undefined) {
    const elapsedMs =
      toDate(now).getTime() - toDate(current.lastCommentAt).getTime();
    if (elapsedMs < limits.minCommentIntervalMin * 60_000) {
      return {
        allowed: false,
        state: current,
        reason: "comment_interval_active",
      };
    }
  }
  return { allowed: true, state: current };
};

export const recordCommentInserted = (
  state: CounterState,
  now: string,
): CounterState => {
  const current = rollCounters(state, now);
  return CounterStateSchema.parse({
    ...current,
    commentsInserted: current.commentsInserted + 1,
    lastCommentAt: now,
  });
};
