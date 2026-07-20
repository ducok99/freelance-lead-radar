# FREELANCE LEAD RADAR

Chrome Extension giúp đội trưởng nhóm freelancer Việt Nam phát hiện bài đăng thuê freelancer trong các nhóm Facebook thuộc allowlist — đọc thụ động ngay trong trình duyệt người dùng đã đăng nhập, chấm điểm 0–100, trích xuất thông tin, soạn bình luận nháp để **con người duyệt trước khi đăng**, lưu lead và phân công cho thành viên.

**Trạng thái (cập nhật 2026-07-20):** P0–P4 đã được DUC duyệt; P4 local QA, ba endpoint smoke test và GitHub Actions đều xanh trên commit `5b9ccf9`. P5.1 đã sửa lỗi entry service worker và được DUC smoke test trên Chrome Windows (allowlist, side panel, Emergency Stop và lưu trạng thái đều đạt); còn chờ GitHub Actions xanh và DUC chính thức duyệt P5. Chưa bắt đầu P6.

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
| [docs/PHASE-P2-REPORT.md](docs/PHASE-P2-REPORT.md)         | Kết quả, kiểm thử, dependency và rủi ro còn lại của Phase 2              |
| [docs/PHASE-P3-REPORT.md](docs/PHASE-P3-REPORT.md)         | Kết quả fixture, adapter chỉ đọc và rủi ro còn lại của Phase 3           |
| [docs/PHASE-P4-REPORT.md](docs/PHASE-P4-REPORT.md)         | Kết quả Workers API, bảo mật, provider và bước smoke test của Phase 4    |
| [docs/PHASE-P5-REPORT.md](docs/PHASE-P5-REPORT.md)         | Candidate MV3, QA, rủi ro và checklist nghiệm thu Phase 5                |
| [apps/extension/README.md](apps/extension/README.md)       | Hướng dẫn build, load unpacked và smoke test extension trên Windows      |
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
