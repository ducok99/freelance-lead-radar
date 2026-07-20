# FREELANCE LEAD RADAR

Chrome Extension giúp đội trưởng nhóm freelancer Việt Nam phát hiện bài đăng thuê freelancer trong các nhóm Facebook thuộc allowlist — đọc thụ động ngay trong trình duyệt người dùng đã đăng nhập, chấm điểm 0–100, trích xuất thông tin, soạn bình luận nháp để **con người duyệt trước khi đăng**, lưu lead và phân công cho thành viên.

**Trạng thái (cập nhật 2026-07-18):** Phase 0 đã được DUC duyệt. Phase 1 (`packages/shared`) **đã hoàn thành và kiểm tra local**, đang chờ DUC nghiệm thu. GitHub Actions vẫn chờ xác minh cho tới khi repository được push lên GitHub.

## Nguyên tắc cốt lõi

Chỉ đọc nội dung đang hiển thị trong nhóm allowlist; không bot server, không né phát hiện, không auto DM, không bình luận hàng loạt; MVP không tự đăng bình luận trong mọi trường hợp; tự dừng khi Facebook cảnh báo; có Emergency Stop; mọi hành động đăng đều có audit log. Chi tiết: `docs/SECURITY.md`.

## Tài liệu

| File                                                       | Nội dung                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| [docs/PRD.md](docs/PRD.md)                                 | Yêu cầu sản phẩm, phân loại 4 loại bài, chấm điểm, giả định & câu hỏi mở |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)               | Kiến trúc monorepo, extension MV3, Workers, ADR                          |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md)                   | Schema entities, enum, storage layout, D1 (giai đoạn 2)                  |
| [docs/SECURITY.md](docs/SECURITY.md)                       | Bất biến an toàn → vị trí thực thi → test bảo vệ                         |
| [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) | 10 phase MVP + 2 phase giai đoạn 2, acceptance criteria từng phase       |
| [docs/TEST-PLAN.md](docs/TEST-PLAN.md)                     | Chiến lược test, fixtures, e2e, giao thức đo precision                   |
| [CLAUDE.md](CLAUDE.md)                                     | Quy tắc làm việc bắt buộc cho phiên code, trạng thái phase               |

## Cấu trúc dự kiến

```
apps/extension        Chrome Extension MV3 + React
apps/dashboard        Web dashboard cho team (giai đoạn 2)
workers/api           Cloudflare Workers (Hono) — AI chạy tại đây
packages/shared       Zod schemas + types + hằng số
packages/rules-engine Hard filters, lexicon tiếng Việt, chấm điểm
packages/facebook-adapter  Trích xuất DOM + thao tác ô bình luận
fixtures/facebook     HTML giả lập (đã làm sạch PII) cho test
```
