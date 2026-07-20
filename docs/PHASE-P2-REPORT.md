# BÁO CÁO PHASE P2 — PACKAGES/RULES-ENGINE

Ngày: 2026-07-20  
Trạng thái: DUC chính thức duyệt ngày 2026-07-20; CI xanh commit `ddf7352`

## 1. Kết quả

P2 đã thay placeholder của `packages/rules-engine` bằng lớp luật nghiệp vụ thuần, không chạm DOM và không gọi mạng:

- Chuẩn hóa tiếng Việt, lexicon thuê freelancer / tìm việc / tuyển full-time / spam, nhận diện lĩnh vực, làm thử miễn phí và không nhận outsourcing.
- `gate()` chặn trước AI theo allowlist, Emergency Stop, dedupe, cảnh báo Facebook, daily limit và hard filters.
- `hardFilters()` trả lý do loại có cấu trúc ở cả pre-AI và post-AI.
- `aggregateScore()` tổng hợp điểm deterministic, giới hạn 0–100 và cap 94 khi AI confidence dưới 0,85.
- Counters reset theo ngày Asia/Bangkok, kiểm tra giới hạn ngày và khoảng cách tối thiểu giữa hai bình luận.
- Circuit breaker chỉ reset thủ công; timestamp và dữ liệu đều parse qua Zod schema dùng chung.
- Máy trạng thái Lead kiểm tra cạnh chuyển, dữ liệu bắt buộc, timestamp và tạo audit draft; không mutate lead đầu vào.

## 2. Dependency mới

- `@flr/shared: workspace:*` cho `@flr/rules-engine`: dùng schema, type và hằng số đã được duyệt ở P1; không tạo bản sao contract.
- `@vitest/coverage-v8@3.2.7` ở root: đo coverage bằng đúng phiên bản Vitest đang khóa và cho CI chặn line coverage rules-engine dưới 90%.

Không thêm dependency runtime bên thứ ba nào khác cho rules-engine.

## 3. Test và dữ liệu mẫu

- `packages/rules-engine`: 161 tests.
- Toàn monorepo: 19 test files, 261 tests.
- Fixture tiếng Việt gán nhãn tay: 40/40 đúng, đạt 100% (ngưỡng yêu cầu ≥90%).
- Rules-engine coverage: 98,17% statements/lines, 92,96% branches, 100% functions.
- Mỗi `FilterReason` có ít nhất 2 case dương và 2 case âm.
- Test riêng xác nhận ESLint từ chối DOM API, `fetch`, `XMLHttpRequest` và `Math.random` trong package.

## 4. Verification local và bản sao sạch

| Lệnh                             | Kết quả                     |
| -------------------------------- | --------------------------- |
| `pnpm install --frozen-lockfile` | Pass                        |
| `pnpm check-secrets`             | Pass                        |
| `pnpm typecheck`                 | Pass — 6/6 workspaces       |
| `pnpm lint`                      | Pass                        |
| `pnpm test`                      | Pass — 19 files, 261 tests  |
| `pnpm test:coverage`             | Pass — line coverage 98,17% |
| `pnpm audit --audit-level=high`  | Pass — 0 lỗ hổng đã biết    |

Toàn bộ bảng trên đã chạy hai lần: trong working tree và trong một bản sao không chứa `node_modules`, `.turbo`, `coverage` hoặc `.git`, cài lại dependency từ lockfile bằng store sạch.

## 5. CI và an toàn

- Workflow dùng `actions/checkout@v5` và `actions/setup-node@v5`, tránh cảnh báo action runtime Node.js 20 đã deprecated.
- Cài pnpm 10.28.0 bằng npm theo version khóa trong `packageManager`, không cần `pnpm/action-setup@v4`.
- Thêm bước `pnpm test:coverage`; build fail nếu line coverage rules-engine dưới 90%.
- `gate()` không thực hiện hành động trên Facebook. Cờ `autoEligible` chỉ là kết quả tính toán; không tồn tại code tự đăng bình luận.

## 6. File nghiệp vụ chính đã thêm

- `packages/rules-engine/src/lexicon.ts`
- `packages/rules-engine/src/filters.ts`
- `packages/rules-engine/src/score.ts`
- `packages/rules-engine/src/counters.ts`
- `packages/rules-engine/src/circuit-breaker.ts`
- `packages/rules-engine/src/transitions.ts`
- `packages/rules-engine/src/fixtures/vietnamese-posts.json`
- 7 module test rules-engine và test ESLint an toàn ở root.

Ngoài ra đã cập nhật exports, workspace dependency, lockfile, Vitest coverage, CI và tài liệu trạng thái.

## 7. Việc cố tình chưa làm

- Không đọc hoặc thao tác DOM Facebook; chưa có selector/adapter.
- Không gọi AI hoặc network.
- Không build extension UI, content script hay background worker.
- Không chèn, click hoặc tự đăng bình luận.
- Không có thao tác live trên Facebook.
- Không bắt đầu P3.

## 8. Rủi ro còn lại

- Lexicon heuristic chỉ là cổng sơ bộ; bài viết mơ hồ được trả `unknown` để AI xử lý ở phase sau, không ép đoán.
- 40 fixture là tập kiểm thử thiết kế sẵn, chưa đại diện đầy đủ cho ngôn ngữ thực tế; precision vận hành vẫn phải đo theo TEST-PLAN với nhãn thật.
- CI P1 đã xanh, nhưng workflow mới và P2 chỉ được xác nhận từ xa sau khi push commit P2.
- Circuit breaker và Emergency Stop hiện mới là luật thuần; khả năng chặn end-to-end chỉ hoàn chỉnh khi P5/P9 nối extension và adapter.

## 9. Điều kiện nghiệm thu

DUC đã trả lời rõ **“Tôi chính thức duyệt P2”** ngày 2026-07-20 sau khi local QA và GitHub Actions của commit `ddf7352` đều xanh. P3 được phép bắt đầu; P4 vẫn chưa được phép.
