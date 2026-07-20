# BÁO CÁO PHASE P1 — PACKAGES/SHARED

Ngày: 2026-07-18  
Trạng thái: Hoàn thành local, chờ DUC nghiệm thu

## 1. Kết quả

P1 đã thay placeholder của `packages/shared` bằng nguồn chân lý Zod dùng chung cho extension, rules-engine và Workers API:

- Constants: schema version, ngưỡng 75/94/95, giới hạn ngày, retention, storage keys và gate Auto Reply.
- Enums: classification, skill, filter reason, lead status, audit action, contact, outcome và warning reason.
- Entities: Settings, GroupRef, TeamMember, RawPost, Extraction, Lead, AuditEvent, CounterState, SystemState và DedupeIndex.
- Contracts: request/response API và discriminated union message nội bộ extension.
- Public TypeScript types đều được suy ra từ Zod schema.

## 2. Dependency mới

- `zod@3.25.76`: dependency runtime duy nhất được thêm cho `@flr/shared`, cần để validate cùng một contract ở client và server. Version được khóa trong lockfile.

## 3. Quyết định triển khai

1. `ClassifyResult` không nhận điểm cuối từ AI. AI chỉ trả phân loại, confidence, điểm thành phần và extraction; Phase 2 sẽ tổng hợp điểm cuối deterministic.
2. `Settings.thresholds` chỉ chấp nhận đúng 75/94/95; UI MVP chỉ hiển thị đọc.
3. `Settings.autoReply.enabled` mặc định `false`. P1 không có runtime hoặc UI tự động đăng.
4. `AuditDetail` chỉ chấp nhận JSON thuần; từ chối đệ quy secret/PII, object đặc biệt, accessor, tham chiếu vòng và khóa prototype-pollution.
5. Thêm `schemaVersion` vào `AuditEvent` và `CounterState` để đúng nguyên tắc mọi bản ghi lưu độc lập có version.
6. API schemas là strict object; classify chỉ gửi dữ liệu bài tối thiểu, trường dư như Facebook cookie/password/group/profile bị từ chối.
7. API base URL bắt buộc HTTPS; HTTP chỉ được phép cho localhost khi phát triển.
8. Lead schema giữ nhất quán status, score, timestamp, outcome và assignment; `LeadMap` bắt buộc khóa trùng `lead.id`.
9. Batch API, tools và contacts từ chối phần tử trùng; token, ULID, postKey, URL và số nguyên có validation biên chặt.

## 4. Test

- `packages/shared`: 87 tests.
- Toàn monorepo: 12 test files, 97 tests.
- Bao phủ thêm sau deep QA: ULID overflow, postKey/URL sai dạng, số nguyên không an toàn, duplicate batch, tối thiểu hóa API, status/timestamp/outcome, LeadMap mismatch, audit cyclic/accessor/non-plain/prototype-pollution và false-positive PII.

## 5. Verification local

| Lệnh                             | Kết quả                   |
| -------------------------------- | ------------------------- |
| `pnpm install --frozen-lockfile` | Pass                      |
| `pnpm check-secrets`             | Pass                      |
| `pnpm typecheck`                 | Pass — 6/6 workspaces     |
| `pnpm lint`                      | Pass                      |
| `pnpm test`                      | Pass — 12 files, 97 tests |
| `pnpm audit --audit-level=high`  | Pass — 0 lỗ hổng đã biết  |

Ngoài kiểm tra trong working tree, bản ZIP phát hành được giải nén sang thư mục hoàn toàn mới, cài dependency bằng lockfile/store sạch và chạy lại toàn bộ bảng trên. ZIP cũng được kiểm tra integrity và không chứa `node_modules`, cache build, file secret hoặc artifact tạm.

## 6. File chính đã thêm

- `packages/shared/src/constants.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/primitives.ts`
- `packages/shared/src/settings.ts`
- `packages/shared/src/post.ts`
- `packages/shared/src/extraction.ts`
- `packages/shared/src/lead.ts`
- `packages/shared/src/audit.ts`
- `packages/shared/src/state.ts`
- `packages/shared/src/api.ts`
- `packages/shared/src/messages.ts`
- 6 test modules cùng `test-fixtures.ts`

Ngoài ra đã cập nhật barrel exports, dependency/lockfile và tài liệu trạng thái/schema/security.

## 7. Việc cố tình chưa làm

- Không triển khai rules-engine hoặc transition logic.
- Không đọc DOM Facebook.
- Không gọi AI hoặc network.
- Không xây extension UI/dashboard.
- Không có code chèn hoặc tự đăng bình luận.
- Không bắt đầu P2.

## 8. Rủi ro còn lại

- GitHub Actions chưa được chạy vì repository chưa được push; local checks đều xanh.
- API/message contracts có thể cần mở rộng có kiểm soát khi P2–P5 triển khai; mọi thay đổi phải cập nhật `DATA-MODEL.md` và test tương ứng.
- Chưa có kiểm thử live Facebook — đúng phạm vi, chỉ xuất hiện ở các phase adapter/beta sau.
- `pnpm audit` phản ánh cơ sở dữ liệu advisory tại thời điểm kiểm tra; tiếp tục chạy CI ở mỗi phase.
