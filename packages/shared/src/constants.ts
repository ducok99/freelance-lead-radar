export const SCHEMA_VERSION = 1 as const;

export const SCORE_THRESHOLDS = Object.freeze({
  ignoreBelow: 75,
  reviewUpTo: 94,
  autoEligibleFrom: 95,
} as const);

export const DEFAULT_LIMITS = Object.freeze({
  maxCommentsPerDay: 10,
  minCommentIntervalMin: 5,
  maxAiCallsPerDay: 200,
} as const);

// P6.1 (DUC yêu cầu & duyệt 2026-07-20): thông báo desktop khi có lead mới
// chờ duyệt — mặc định BẬT vì đây là mục đích chính của tính năng; người dùng
// tắt được trong Options. Chỉ là thông báo cục bộ của Chrome, không gửi dữ
// liệu đi đâu, không tạo thao tác nào lên Facebook.
export const DEFAULT_NOTIFICATIONS = Object.freeze({
  enabled: true,
} as const);

export const DEFAULT_RETENTION_DAYS = 90 as const;
export const DEFAULT_TIME_ZONE = "Asia/Bangkok" as const;
export const MAX_AUDIT_EVENTS = 5_000 as const;
export const API_MAX_BATCH_SIZE = 10 as const;
export const API_MAX_PAYLOAD_BYTES = 64 * 1_024;
export const API_RATE_LIMIT_PER_MINUTE = 60 as const;
export const API_PROVIDER_TIMEOUT_MS = 15_000 as const;
export const AUTO_REPLY_MIN_CONFIDENCE = 0.85 as const;
export const AUTO_REPLY_MIN_LABELED_LEADS = 100 as const;
export const AUTO_REPLY_MIN_PRECISION = 0.9 as const;

export const DEFAULT_TEAM_SKILLS = Object.freeze([
  "graphic_design",
  "video_editing",
  "web_dev",
  "architecture",
] as const);

export const STORAGE_KEYS = Object.freeze({
  settings: "flr:settings",
  leads: "flr:leads",
  dedupe: "flr:dedupe",
  audit: "flr:audit",
  counters: "flr:counters",
  state: "flr:state",
} as const);
