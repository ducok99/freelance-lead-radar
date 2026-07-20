# BÁO CÁO PHASE P3 — FACEBOOK FIXTURES + ADAPTER

Ngày: 2026-07-20  
Trạng thái: Hoàn thành local, chờ DUC nghiệm thu

## 1. Kết quả

P3 đã thay placeholder `packages/facebook-adapter` bằng lớp đọc DOM cô lập, không gọi mạng và không thực hiện hành động ghi lên Facebook:

- `parsePostKey` / `parsePostReference` hỗ trợ 7 dạng URL bài nhóm và tạo canonical permalink không tracking.
- `extractPost` đọc article theo role/aria/thuộc tính ngữ nghĩa, parse lại bằng `RawPostSchema` và luôn trả dữ liệu hợp lệ hoặc `ExtractionFailure` có mã; DOM lạ không làm throw ra pipeline.
- `findPostElements` loại article lồng trong bài share và cho phép feed xen bài tài trợ/placeholder thất bại có kiểm soát.
- `detectWarningSignals` nhận checkpoint, CAPTCHA, login redirect, banner tạm chặn và cảnh báo Facebook; không hiểu nhầm câu tương tự bên trong bài thường.
- `findCommentBox` chỉ định vị ô bình luận theo role/aria/placeholder. P3 chưa điền nội dung và không click bất kỳ nút nào.
- Export surface được test bằng allowlist chính xác; không thể vô tình thêm hàm submit/publish/click mà test vẫn xanh.

## 2. Fixtures và làm sạch dữ liệu

- 12 fixture HTML, mỗi fixture có `.meta.json` cùng tên.
- 8 biến thể extraction: text, truncated, anonymous, image, shared, contact, mixed feed 10 article và permalink có comment box.
- 1 layout bị cắt xén để kiểm tra failure; 3 trang cảnh báo gồm checkpoint, CAPTCHA và temporarily-blocked.
- Tên/ID/profile đều giả; điện thoại được che; email dùng `.test`; ảnh là data URI 1×1; không có cookie/session/token/tracking hoặc URL ảnh Facebook.

Fixture là HTML tổng hợp tối thiểu dựa trên cấu trúc ngữ nghĩa, không phải DOM nguyên trạng tải từ tài khoản thật.

## 3. Dependency mới

- `@flr/shared: workspace:*` cho adapter: dùng `RawPostSchema` và type cảnh báo đã duyệt, không lặp contract.
- `happy-dom@20.11.0` ở root devDependencies: tạo DOM cô lập cho unit test theo TEST-PLAN; không đi vào runtime extension.

## 4. Test và coverage

- `packages/facebook-adapter`: 55 tests.
- Toàn monorepo: 24 test files, 315 tests.
- Facebook-adapter: 97,29% statements/lines, 85,10% branches, 100% functions.
- Rules-engine regression: 98,17% statements/lines, 92,96% branches, 100% functions.
- CI có threshold riêng: adapter line ≥80%, rules-engine line ≥90%.

## 5. Xác minh độc lập

Toàn bộ chuỗi kiểm tra được chạy lại trong một thư mục sạch với pnpm store mới, không dùng `node_modules` hoặc Turbo cache của thư mục phát triển:

| Kiểm tra                         | Kết quả                                              |
| -------------------------------- | ---------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Đạt                                                  |
| `scripts/check-secrets.sh`       | Đạt, không phát hiện secret                          |
| `pnpm typecheck`                 | Đạt, 6/6 workspace                                   |
| `pnpm lint`                      | Đạt                                                  |
| `pnpm test`                      | Đạt, 24 files / 315 tests                            |
| `pnpm test:coverage`             | Đạt, adapter 97,29% lines; rules-engine 98,17% lines |
| `pnpm audit --audit-level=high`  | Đạt, không có vulnerability đã biết                  |

## 6. Quyết định triển khai

1. Selector chỉ dùng role, aria, cấu trúc ngữ nghĩa, `data-ad-preview`/`data-testid`; không dùng class obfuscated.
2. Permalink được canonical hóa về `https://www.facebook.com/groups/{gid}/posts/{pid}/`; query tracking không được giữ.
3. Field optional không tìm thấy được bỏ (`undefined` khi còn trong bộ nhớ) theo `RawPostSchema` P1, thay vì đổi schema sang `null` trong P3.
4. Bài share lồng article chỉ extract article ngoài; pipeline không xử lý nội dung bài được share như một lead độc lập.
5. Câu “thử lại sau” trong nội dung bài thường không trip cảnh báo; text warning chỉ xét vùng alert/dialog/live hoặc trang không có article.
6. Không implement `fillCommentBox`; hành vi điền được giữ đúng phase P7 sau khi có enforcement P5/P6.

## 7. Việc cố tình chưa làm

- Không MutationObserver/content script/background worker.
- Không gọi AI, API hoặc mạng.
- Không điền nội dung vào ô bình luận.
- Không click Đăng, submit, publish hoặc tự tương tác.
- Không test live Facebook; test tự động chỉ dùng fixture local.
- Không bắt đầu P4.

## 8. Rủi ro còn lại

- Facebook chắc chắn có thể đổi cấu trúc DOM; fixture giúp phát hiện regression nhưng không loại bỏ rủi ro drift.
- Locator hiện hỗ trợ giao diện desktop `www.facebook.com`; không hỗ trợ m.facebook/mbasic theo A-05.
- Adapter mới là thư viện cô lập, chưa được nối với allowlist/Emergency Stop/circuit breaker ba lớp; phần này thuộc P5–P9.
- Dù chỉ đọc, việc dùng extension để đọc DOM Facebook vẫn có rủi ro điều khoản nền tảng như SECURITY §8.

## 9. Điều kiện nghiệm thu

DUC đã trả lời rõ **“Tôi chính thức duyệt P3”** ngày 2026-07-20 sau khi local QA và GitHub Actions của commit `f4a8ba2` đều xanh. P4 được phép bắt đầu; P5 vẫn chưa được phép.
