# DATA-MODEL — FREELANCE LEAD RADAR

v0.3 — 2026-07-20 — cập nhật theo Phase 6 candidate. Zod schema trong `packages/shared` là nguồn chân lý; tài liệu này mô tả để người đọc không cần mở code. Mọi bản ghi lưu độc lập có `schemaVersion` để migrate về sau.

## 1. Nguyên tắc dữ liệu

1. **Tối thiểu hóa dữ liệu cá nhân**: chỉ lưu những gì người đăng tự công khai trong bài và cần cho việc xử lý lead. Không lưu ảnh, không lưu danh sách bạn bè, không lưu gì về người bình luận khác.
2. **Không bao giờ lưu**: mật khẩu, cookie, session token Facebook, nội dung tin nhắn riêng.
3. Mọi giá trị chuẩn hóa (ngân sách, deadline) luôn giữ kèm chuỗi gốc `raw`.
4. Tên trường camelCase trong TypeScript, snake_case trong D1; mapping 1-1.

## 2. Entity chính

### 2.1 Settings (`flr:settings`)

| Trường                | Kiểu           | Mô tả                                                                                                                                                                                                                                                                |
| --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allowlist             | `GroupRef[]`   | `{groupId, name, url, active}` — nhóm được phép theo dõi                                                                                                                                                                                                             |
| teamSkills            | `SkillField[]` | Lĩnh vực team nhận (đã chốt: `graphic_design`, `video_editing`, `web_dev`, `architecture`)                                                                                                                                                                           |
| teamProfile           | `string`       | 2–3 câu năng lực dùng để cá nhân hóa bình luận                                                                                                                                                                                                                       |
| members               | `TeamMember[]` | Xem 2.2                                                                                                                                                                                                                                                              |
| thresholds            | object         | `{ignoreBelow: 0, reviewUpTo: 94, autoEligibleFrom: 95}` — hằng số, hiển thị chỉ-đọc trong MVP. `ignoreBelow` = 0 từ 2026-07-22 (P6.11): điểm không còn quyết định bài có vào hàng đợi hay không, chỉ classification + hard filter mới quyết định (xem PRD.md mục 7) |
| limits                | object         | `{maxCommentsPerDay: 10, minCommentIntervalMin: 5, maxAiCallsPerDay: 200}` (mặc định A-08)                                                                                                                                                                           |
| autoReply             | object         | `{enabled: false, …}` — **mặc định false, MVP không có UI bật**                                                                                                                                                                                                      |
| notifications         | object         | `{enabled: true}` — thông báo desktop khi có lead mới chờ duyệt (P6.1, DUC duyệt 2026-07-20). Thông báo cục bộ của Chrome, tắt được trong Options                                                                                                                    |
| retentionDays         | number         | 90 (A-09)                                                                                                                                                                                                                                                            |
| apiBaseUrl, teamToken | string         | API thuộc `*.workers.dev` (hoặc localhost khi dev); token rỗng hoặc ≥32 ký tự, không phải credential FB                                                                                                                                                              |
| schemaVersion         | number         |                                                                                                                                                                                                                                                                      |

### 2.2 TeamMember

| Trường  | Kiểu           | Ghi chú                 |
| ------- | -------------- | ----------------------- |
| id      | string (ulid)  |                         |
| name    | string         |                         |
| skills  | `SkillField[]` | Dùng để gợi ý phân công |
| contact | string?        | Zalo/phone nội bộ team  |
| active  | boolean        |                         |

### 2.3 RawPost (kết quả trích xuất, dữ liệu tạm trước khi thành Lead)

| Trường             | Kiểu         | Ghi chú                                                   |
| ------------------ | ------------ | --------------------------------------------------------- |
| postKey            | string       | `"{groupId}:{postId}"` — khóa dedupe toàn hệ thống        |
| groupId, permalink | string       | groupId an toàn; permalink HTTPS đúng dạng bài trong nhóm |
| authorName         | string?      | Tên hiển thị công khai; `"(ẩn danh)"` nếu poster ẩn danh  |
| authorProfileUrl   | string?      | Chỉ khi công khai trong DOM bài viết                      |
| anonymousPoster    | boolean      |                                                           |
| text               | string       | Nội dung hiển thị                                         |
| truncated          | boolean      | Bài đang bị cắt "Xem thêm" (A-11)                         |
| postedAtText       | string?      | Chuỗi thời gian FB hiển thị ("2 giờ", "Hôm qua")          |
| seenAt             | string (ISO) | Thời điểm extension nhìn thấy                             |

### 2.4 Lead (`flr:leads` — map `id → Lead`)

| Trường                              | Kiểu                               | Ghi chú                                                                        |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| id                                  | string (ulid)                      |                                                                                |
| post                                | RawPost                            | Nhúng nguyên bản                                                               |
| classification                      | `Classification`                   | Xem §5                                                                         |
| confidence                          | number 0–1                         | Từ AI                                                                          |
| score                               | number 0–100                       | Điểm cuối do rules-engine tổng hợp                                             |
| scoreBreakdown                      | object                             | `{intent, budget, fieldMatch, urgency, contact, quality, adjustments[]}`       |
| autoEligible                        | boolean                            | Chỉ khi `hiring_freelancer`, không filter, score ≥95, confidence ≥0.85         |
| extraction                          | `Extraction`                       | Xem 2.5                                                                        |
| status                              | `LeadStatus`                       | Máy trạng thái §4                                                              |
| filterReasons                       | `FilterReason[]`                   | Nếu bị loại                                                                    |
| draft                               | object?                            | `{aiText, editedText?, rationale, createdAt}`                                  |
| processingError                     | object?                            | `{code, message, retryable, occurredAt}`; giữ lead để retry, không mất dữ liệu |
| finalComment                        | string?                            | Nội dung thực tế đã chèn                                                       |
| approvedAt, commentedAt, skippedAt  | ISO?                               |                                                                                |
| assignedTo                          | memberId?                          |                                                                                |
| label                               | `"correct" \| "incorrect" \| null` | Nhãn đo precision (US-07)                                                      |
| labelNote                           | string?                            |                                                                                |
| outcome                             | `"won" \| "lost" \| null`          | Ghi tay                                                                        |
| schemaVersion, createdAt, updatedAt |                                    |                                                                                |

### 2.5 Extraction

| Trường     | Kiểu                                                                     | Ví dụ                                                                                              |
| ---------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| jobSummary | string                                                                   | "Edit 10 video TikTok 1–2p từ footage có sẵn"                                                      |
| field      | `SkillField \| "other"`                                                  | `video_editing`                                                                                    |
| budget     | object?                                                                  | `{raw: "300k/video", minVnd: 300000, maxVnd: 300000, per: "unit" \| "project" \| "month" \| null}` |
| deadline   | object?                                                                  | `{raw: "tối nay", date: "2026-07-18"?}`                                                            |
| tools      | string[]                                                                 | ["CapCut", "Premiere"]                                                                             |
| contacts   | `{channel: "phone"\|"zalo"\|"email"\|"messenger_hint", value: string}[]` | Chỉ thông tin công khai trong bài                                                                  |

### 2.6 AuditEvent (`flr:audit` — ring buffer, tối đa 5000 bản ghi)

| Trường            | Kiểu                                                             |
| ----------------- | ---------------------------------------------------------------- |
| id, ts            | ulid, ISO                                                        |
| actor             | `"user" \| "system"`                                             |
| action            | `AuditAction` (§5)                                               |
| leadId?, postKey? | string                                                           |
| detail            | object JSON; schema từ chối secret, credential và trường PII thô |
| schemaVersion     | `1`                                                              |

Append-only: không có API sửa/xóa từng bản ghi; chỉ ring-buffer tự cắt bản ghi cũ nhất khi vượt 5000 (và purge theo retention).
`detail` chỉ nhận object/array JSON thuần, không accessor/class/tham chiếu vòng; từ chối khóa prototype-pollution và dò secret/PII ở mọi cấp.

### 2.7 CounterState (`flr:counters`) và SystemState (`flr:state`)

```jsonc
// flr:counters — reset theo ngày (múi giờ Asia/Bangkok)
{ "date": "2026-07-18", "aiCalls": 42, "commentsInserted": 3, "lastCommentAt": "…",
  "extractionAttempts": 120, "extractionFailures": 6, "schemaVersion": 1 }

// flr:state
{ "emergencyStop": false,
  "circuitBreaker": { "state": "armed" | "tripped", "reason": "checkpoint_detected"?, "trippedAt": "…"? },
  "schemaVersion": 1 }
```

Circuit breaker `tripped` chỉ trở về `armed` khi **người dùng bấm reset thủ công** sau khi đã tự kiểm tra tài khoản.

### 2.8 DedupeIndex (`flr:dedupe` — map `postKey → {leadId?, decidedAt, terminal: boolean}`)

Ghi cho MỌI bài đã nhìn thấy và ra quyết định (kể cả bị loại hoặc < 75 điểm) để không xử lý lại và không gọi AI lại. Prune theo retention.

## 3. Enum

### Classification

`hiring_freelancer` | `seeking_work` | `fulltime_recruitment` | `ad_or_spam` | `other`

### SkillField (đã chốt 2026-07-18 theo A-01, vẫn cấu hình được)

`graphic_design` (gồm banner, poster, ấn phẩm in, thư mời) | `video_editing` | `web_dev` | `architecture` | `other`

Lưu ý: team không nhận content/marketing thuần — lĩnh vực này KHÔNG nằm trong danh sách, bài thuê content sẽ bị loại `no_team_skill_match`.

### FilterReason — hard filters và lý do loại vận hành

| Mã                        | Ý nghĩa                                             | Giai đoạn chạy                                    |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| `poster_seeking_work`     | Người đăng đang tìm việc                            | Sau AI (lexicon rõ ràng thì bắt được trước AI)    |
| `fulltime_recruitment`    | Tuyển nhân viên full-time                           | Sau AI (hoặc trước nếu lexicon rõ)                |
| `free_trial_required`     | Yêu cầu làm thử miễn phí                            | Sau AI                                            |
| `no_outsourcing`          | Nói rõ không thuê ngoài                             | Sau AI                                            |
| `already_processed`       | Bài đã xử lý (dedupe)                               | Trước AI                                          |
| `no_team_skill_match`     | Lĩnh vực ngoài chuyên môn team                      | Sau AI (trước AI nếu keyword field rõ)            |
| `group_not_allowlisted`   | Nhóm ngoài allowlist                                | Trước AI (content script không chạy)              |
| `facebook_warning_active` | FB đang hiển thị cảnh báo / circuit breaker tripped | Trước AI (chặn toàn pipeline)                     |
| `daily_limit_reached`     | Vượt giới hạn hoạt động ngày                        | Trước AI (với AI call) / trước chèn (với comment) |
| `ad_or_spam`              | AI/heuristic xác định quảng cáo hoặc spam           | Trước hoặc sau AI                                 |
| `classification_rejected` | AI phân loại `other`, không phải lead cần xử lý     | Sau AI                                            |
| `insufficient_text`       | Nội dung hiển thị quá ngắn để phân tích an toàn     | Trước AI                                          |

### LeadStatus và AuditAction — xem §4 và bảng dưới

AuditAction: `post_detected`, `filtered`, `ai_classified`, `ai_error`, `retry_requested`, `pipeline_resumed`, `draft_created`, `draft_edited`, `approved`, `comment_inserted`, `comment_confirmed`, `skipped`, `labeled`, `assigned`, `outcome_set`, `emergency_stop_on`, `emergency_stop_off`, `circuit_tripped`, `circuit_reset`, `settings_changed`, `data_purged`, `data_exported` (giai đoạn 2 thêm `autoreply_*`).

## 4. Máy trạng thái Lead

```
                              ┌────────────► filtered_out (kèm filterReasons)
                              │
detected ── rules+AI ─────────┼────────────► below_threshold (score < 75)
                              │
                              └────────────► needs_review (75–100; autoEligible là cờ riêng)
                                                 │
                    ┌────────────────────────────┼───────────────┐
                    ▼                            ▼               ▼
                 skipped                     approved ──► comment_inserted ──► commented
                                                                              (adapter xác nhận
                                                                               comment xuất hiện)
                                                 │
                                                 ▼
                                             assigned ──► won | lost
```

Quy tắc: mọi transition qua hàm `transition()` trong rules-engine; transition không hợp lệ → error + audit. `filtered_out`, `below_threshold`, `skipped`, `won`, `lost` là trạng thái kết thúc (terminal) cho dedupe.

## 5. Layout chrome.storage.local (MVP)

| Key                         | Nội dung               | Chính sách dung lượng (quota ~10MB)                                              |
| --------------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `flr:settings`              | Settings               | Nhỏ                                                                              |
| `flr:leads`                 | map id → Lead          | Purge theo retention; khi gần quota: xóa dần lead terminal cũ nhất + cảnh báo UI |
| `flr:dedupe`                | map postKey → entry    | Prune theo retention                                                             |
| `flr:audit`                 | AuditEvent[] ring 5000 | Tự cắt                                                                           |
| `flr:counters`, `flr:state` | Như §2.7               | Nhỏ                                                                              |

Ước lượng: 1 lead ≈ 2–4KB → ~2000 lead thoải mái trong quota với retention 90 ngày ở quy mô A-12.

## 6. D1 schema (GIAI ĐOẠN 2 — bản nháp để thiết kế trước, chưa triển khai)

```sql
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  post_key TEXT UNIQUE NOT NULL,
  group_id TEXT NOT NULL,
  permalink TEXT NOT NULL,
  author_name TEXT,
  anonymous_poster INTEGER NOT NULL DEFAULT 0,
  post_text TEXT NOT NULL,
  classification TEXT NOT NULL,
  confidence REAL NOT NULL,
  score INTEGER NOT NULL,
  score_breakdown TEXT NOT NULL,        -- JSON
  auto_eligible INTEGER NOT NULL DEFAULT 0,
  extraction TEXT NOT NULL,             -- JSON
  status TEXT NOT NULL,
  filter_reasons TEXT,                  -- JSON array
  draft TEXT,                           -- JSON
  final_comment TEXT,
  assigned_to TEXT REFERENCES team_members(id),
  label TEXT,                           -- correct | incorrect | NULL
  outcome TEXT,                         -- won | lost | NULL
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY, ts TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, lead_id TEXT, post_key TEXT, detail TEXT
);
CREATE INDEX idx_audit_ts ON audit_events(ts);

CREATE TABLE team_members (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, skills TEXT NOT NULL,
  contact TEXT, active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE kv_settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
```

Chiến lược đồng bộ local → D1 (batched upsert theo `updated_at`, xử lý xung đột) là **câu hỏi mở của giai đoạn 2**, sẽ chốt trong phase G2-1 — không ảnh hưởng MVP.

## 7. Hợp đồng schema dùng chung đã triển khai ở Phase 1

- API: `HealthResponse`, `ClassifyRequest/Response`, `DraftRequest/Response`, `ApiErrorResponse` đều là strict schema và có `schemaVersion`.
- `ClassifyResult` chỉ chứa phân loại, confidence, điểm thành phần và extraction. Điểm cuối không đến từ AI; `rules-engine` Phase 2 mới tổng hợp deterministic.
- Batch phân loại từ 1–10 bài, không nhận `postKey`/kỹ năng trùng; response cũng không được rỗng hoặc trùng `postKey`.
- `PostInput` gửi backend chỉ gồm `postKey`, text, cờ ẩn danh/cắt gọn và thời gian hiển thị tùy chọn; không gửi groupId, permalink, tên/profile tác giả hoặc `seenAt`.
- Request không có trường password, cookie, session hoặc Facebook credential và strict schema từ chối trường dư.
- Message nội bộ là discriminated union: gate state, post seen/extraction failure, warning, Emergency Stop, circuit reset, lấy/cập nhật lead, sửa nháp, duyệt/bỏ qua, retry và cập nhật badge điểm. Hợp đồng comment assist vẫn tồn tại nhưng P6 background cố tình không xử lý đến P7.
- `Lead` kiểm tra nhất quán ngưỡng–status, metadata vòng đời, outcome/assignedTo, thứ tự timestamp; khóa `LeadMap` phải trùng `lead.id`.
- `AuditDetail` chỉ nhận JSON thuần và từ chối đệ quy secret/PII, accessor, object đặc biệt, tham chiếu vòng và khóa prototype-pollution.
- ULID kiểm tra đúng miền timestamp 48-bit; postKey/URL Facebook và số nguyên đều có giới hạn chặt để lưu/so sánh ổn định.
- Các type public đều suy ra từ Zod schema; không có định nghĩa type nghiệp vụ lặp tay.

## 8. Ví dụ một Lead hoàn chỉnh (JSON)

```json
{
  "id": "01J2ZK8Q9M3T5V7X9A1C3E5G7J",
  "post": {
    "postKey": "1234567890:9876543210",
    "groupId": "1234567890",
    "permalink": "https://www.facebook.com/groups/1234567890/posts/9876543210/",
    "authorName": "Nguyen V.",
    "anonymousPoster": false,
    "text": "Cần 1 bạn edit 10 video TikTok 1-2p, có kịch bản và footage sẵn. Budget 300k/video. Cần xong trước CN. Ưu tiên biết CapCut. Ib mình hoặc zalo 09xx xxx xxx.",
    "truncated": false,
    "postedAtText": "2 giờ",
    "seenAt": "2026-07-18T09:12:00+07:00"
  },
  "classification": "hiring_freelancer",
  "confidence": 0.93,
  "score": 88,
  "scoreBreakdown": {
    "intent": 38,
    "budget": 15,
    "fieldMatch": 15,
    "urgency": 10,
    "contact": 10,
    "quality": 8,
    "adjustments": [{ "reason": "repost_suspect", "delta": -8 }]
  },
  "autoEligible": false,
  "extraction": {
    "jobSummary": "Edit 10 video TikTok 1-2 phút từ kịch bản + footage có sẵn",
    "field": "video_editing",
    "budget": {
      "raw": "300k/video",
      "minVnd": 300000,
      "maxVnd": 300000,
      "per": "unit"
    },
    "deadline": { "raw": "trước CN", "date": "2026-07-19" },
    "tools": ["CapCut"],
    "contacts": [{ "channel": "zalo", "value": "09xx xxx xxx" }]
  },
  "status": "needs_review",
  "draft": {
    "aiText": "Chào bạn, bên mình chuyên edit video TikTok ngắn, đang trống lịch nên nhận kịp deadline trước CN của bạn. Team làm CapCut và Premiere hằng ngày, có sẵn mẫu nhịp cắt cho video 1-2p. Bạn ib mình xem portfolio và chốt giá theo 10 video nhé.",
    "rationale": "Ý định thuê rõ, ngân sách cụ thể, đúng lĩnh vực video_editing của team, deadline gấp.",
    "createdAt": "2026-07-18T09:12:20+07:00"
  },
  "label": null,
  "assignedTo": null,
  "outcome": null,
  "schemaVersion": 1,
  "createdAt": "2026-07-18T09:12:20+07:00",
  "updatedAt": "2026-07-18T09:12:20+07:00"
}
```
