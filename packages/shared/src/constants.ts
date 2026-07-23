export const SCHEMA_VERSION = 1 as const;

// P6.11 (DUC yêu cầu 2026-07-22): bỏ ngưỡng điểm tối thiểu để vào hàng đợi
// duyệt. Trước đây bài < 75 điểm bị đẩy sang "below_threshold" (gộp hiển thị
// cùng "Đã lọc"), kể cả khi AI đã phân loại đúng là hiring_freelancer — vì
// model AI free hay chấm thiếu vài mục con (ngân sách/gấp/liên hệ) trên bài
// Facebook ngắn, khiến bài thuê thật bị giấu đi. Từ nay: bài chỉ bị loại khỏi
// hàng đợi nếu hard filter hoặc AI phân loại KHÔNG PHẢI hiring_freelancer;
// điểm vẫn tính đủ 6 tiêu chí và hiển thị để tham khảo/sắp xếp, không còn
// dùng để loại bài. ignoreBelow = 0 khiến "below_threshold" không còn xảy ra
// (ScoreSchema tối thiểu là 0) nhưng vẫn giữ nguyên status/transition để dễ
// khôi phục nếu cần. reviewUpTo/autoEligibleFrom KHÔNG đổi — Auto Reply vẫn
// theo đúng điều kiện cũ.
export const SCORE_THRESHOLDS = Object.freeze({
  ignoreBelow: 0,
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
// P6.13 (DUC báo lỗi "AI tạm thời không khả dụng"/"Không kết nối được" 2026-07-23):
// log thật từ wrangler tail (workers/api, env free) cho thấy /v1/classify mất
// 15397ms rồi mới trả 502 — tức backend thử AI 2 lần (callProviderWithRetry)
// cộng lại đã vượt quá 15s, trong khi extension tự huỷ đúng lúc 15s. Kết quả:
// extension bỏ cuộc ngay trước/sau khi backend vừa xong, tuỳ may rủi vài trăm
// ms — hiện lúc thì "Không kết nối được", lúc thì "AI tạm thời không khả dụng"
// cho cùng một nguyên nhân. Tăng lên 30s để đủ chỗ cho cả 2 lần thử của
// backend hoàn thành trước khi extension huỷ. Không đổi callProviderWithRetry
// (số lần thử, repair instruction) — vẫn giữ nguyên logic đã test.
export const API_PROVIDER_TIMEOUT_MS = 30_000 as const;
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
