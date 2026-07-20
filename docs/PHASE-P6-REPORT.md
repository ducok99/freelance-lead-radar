# PHASE P6 REPORT — Pipeline end-to-end chỉ đọc

Ngày: 2026-07-20  
Trạng thái: **Candidate v0.6.0; local QA đạt; chờ GitHub Actions E2E, smoke Chrome Windows và DUC duyệt. P7 chưa bắt đầu.**

## Kết quả đã triển khai

- Content script chỉ hoạt động trên nhóm allowlist, đọc các bài đang hiển thị,
  phát hiện cảnh báo trước khi extract và không tự điều hướng, refresh hay bấm
  “Xem thêm”.
- Pipeline hoàn chỉnh: extract → dedupe bền vững → hard filter trước AI → batch
  classify tối đa 10 bài → hard filter sau AI → tổng hợp điểm deterministic →
  tạo nháp → lưu lead/audit/counters → cập nhật side panel và badge Shadow DOM.
- Lead dưới 75 điểm và bài bị lọc không vào hàng đợi duyệt; tab **Đã lọc** hiển
  thị lý do. Lead đạt ngưỡng có breakdown, extraction, nháp và link bài gốc.
- Hành động P6 chỉ đổi dữ liệu local: sửa/lưu nháp, duyệt lead, bỏ qua và retry.
  Không có nút hoặc code path chèn/click/submit/đăng bình luận lên Facebook.
- API lỗi hoặc mất mạng giữ nguyên lead với `processingError` có thể retry. Nếu
  Chrome dừng service worker giữa pipeline, lead `detected` chưa hoàn tất tự
  tiếp tục khi worker khởi động lại.
- Retry và xử lý lại luôn kiểm tra Emergency Stop, circuit breaker, allowlist và
  giới hạn AI trong ngày. Dedupe lưu trước API để reload feed không gọi AI lại.
- `LeadStore` ghi lead, dedupe, audit và counters bằng một lần
  `chrome.storage.local.set`; commit trong một worker được tuần tự hóa.
- Host permission chỉ gồm Facebook, `*.workers.dev` và localhost dành cho E2E;
  schema Settings từ chối API HTTPS tùy ý ngoài Workers.dev.

## Audit P6

Chuỗi sự kiện được ghi bằng schema strict: `post_detected`, `filtered`,
`ai_classified`, `ai_error`, `retry_requested`, `pipeline_resumed`,
`draft_created`, `draft_edited`, `approved`, `skipped`, Emergency Stop và circuit
breaker. Audit không chứa nguyên văn bài hoặc token trong `detail`.

## QA tại Codex

| Gate                             | Kết quả                                               |
| -------------------------------- | ----------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Đạt với pnpm 10.28.0                                  |
| `pnpm typecheck`                 | Đạt, 6/6 workspace                                    |
| `pnpm lint` + Prettier           | Đạt                                                   |
| `pnpm test`                      | Đạt, 39 file / 407 test                               |
| `pnpm test:coverage`             | Đạt, toàn repo 90,57% line                            |
| Rules-engine coverage            | 97,83% line (gate ≥90%)                               |
| Extension coverage               | Đạt gate ≥80%                                         |
| `check-secrets`                  | Đạt, không phát hiện secret                           |
| `check-api-safety`               | Đạt, không Facebook bot/proxy/stealth dependency      |
| Build MV3 + verifier             | Đạt, version 0.6.0, đúng SW/content entry             |
| Playwright discovery             | Đạt, 2 test trong 2 file                              |
| Playwright execution tại Codex   | Chưa chạy được: môi trường không có Chromium binary   |
| E2E Windows lần đầu              | Phát hiện và sửa fixture score 96 vượt trần `quality` |

## E2E đã viết, chờ CI chạy thật

1. Nhóm ngoài allowlist: 0 `POST_SEEN`, không lead/dedupe/audit.
2. Feed giả lập 10 bài + mock API local: 3 lead cần duyệt; điểm 96 đúng; bài bị
   lọc có lý do; 1 classify batch + 3 draft; reload không phát sinh classify;
   sửa nháp + duyệt persist và có audit; side panel không có nút Chèn/Đăng.

Mock API tạo breakdown theo đúng các trần schema (40/15/15/10/10/10) và parse
qua `ClassifyResponseSchema` trước khi trả về. Việc này ngăn fixture score cao
vô tình làm cả batch thành `invalid_response` như lần chạy Windows đầu tiên.

GitHub Actions đã có bước cài Chromium trước `pnpm test:e2e`. P6 chỉ đủ điều kiện
duyệt khi workflow của commit P6 xanh.

## Dependency và quyền

- Không thêm dependency bên ngoài. Extension chỉ thêm hai workspace dependency
  nội bộ đã có: `@flr/rules-engine` và `@flr/facebook-adapter`.
- Quyền Chrome vẫn là `storage`, `sidePanel`; không có `tabs`, `cookies`,
  `webRequest`, `scripting`, `history` hay `<all_urls>`.
- Host mới `*.workers.dev`, localhost và `127.0.0.1` là bắt buộc để background
  gọi Workers API và để E2E local chạy; manifest snapshot khóa chính xác danh sách.

## Nhóm file thay đổi

- Shared: enums, lead processing error, message contracts, URL API schema và test.
- Rules engine: filter reason sau AI, counter draft và test.
- Extension background: API client, pipeline, controller, service worker và test.
- Extension content: scanner, gate, badge Shadow DOM và test retry/warning.
- Extension data/UI: LeadStore, storage atomic, side panel, popup/options, styles.
- Extension config/E2E: manifest v0.6.0, workspace deps, coverage include và hai
  Playwright scenario.
- Tài liệu: README, CLAUDE, Architecture, Data Model, Security, Test Plan,
  Implementation Plan, hướng dẫn extension và báo cáo này.

## Rủi ro còn lại / cố tình chưa làm

- Selector Facebook có thể thay đổi. P6 fail-safe khi extract lỗi và không tự bấm
  “Xem thêm”; cần smoke trên một nhóm test với dữ liệu thật đã che PII khi báo cáo.
- Gọi API production cần deploy Worker, đặt đúng `TEAM_TOKEN`, `EXTENSION_ORIGIN`
  và dùng URL `*.workers.dev`; P6 candidate chưa tự deploy hạ tầng.
- Chromium E2E chưa thể chạy trong máy Codex; phải xem workflow GitHub xanh.
- Retention/quota purge và onboarding rủi ro thuộc P9.
- P6 **không chèn bình luận, không click Đăng, không DM và không Auto Reply**.
  Toàn bộ comment assist thuộc P7 và chưa được phép cho tới khi DUC duyệt P6.

## Checklist DUC để nghiệm thu

1. Đẩy candidate lên GitHub và xác nhận workflow **Complete P6 read-only
   pipeline** xanh, đặc biệt hai E2E.
2. Build rồi Reload extension v0.6.0; xác nhận Chrome không báo Errors.
3. Cấu hình Worker URL/token test và một nhóm allowlist; mở nhóm bằng tay.
4. Xác nhận lead/bài bị lọc/điểm/nháp xuất hiện đúng; sửa nháp, bấm Duyệt lead.
5. Xác nhận không có nút Chèn/Đăng và extension không tự sửa ô bình luận.
6. Reload trang: không thấy AI calls tăng lại cho cùng bài. Thử Emergency Stop:
   hoạt động mới phải dừng.
7. Gửi ảnh CI + ảnh side panel đã che PII. Chỉ sau đó mới tuyên bố chính thức
   duyệt P6.
