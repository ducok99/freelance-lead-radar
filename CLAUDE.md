# CLAUDE.md — FREELANCE LEAD RADAR

Hướng dẫn bắt buộc cho mọi phiên làm việc của Claude (và dev) trong repo này. Đọc trước khi viết bất kỳ dòng code nào.

## Dự án là gì

Chrome Extension (MV3) cho đội trưởng nhóm freelancer Việt Nam: đọc THỤ ĐỘNG các nhóm Facebook trong allowlist ngay trong trình duyệt người dùng đã đăng nhập, phát hiện bài thuê freelancer, chấm điểm 0–100, trích xuất thông tin, soạn bình luận nháp để CON NGƯỜI duyệt và tự bấm Đăng. AI chạy ở Cloudflare Workers. Chi tiết: `docs/PRD.md`.

## Quy trình làm việc BẮT BUỘC (yêu cầu từ chủ dự án DUC)

1. Làm theo phase trong `docs/IMPLEMENTATION-PLAN.md`. **Không làm trước phase chưa được duyệt.**
2. Không tự ý mở rộng tính năng, kể cả khi "tiện tay". Thấy cần → đề xuất, chờ duyệt.
3. Không xóa/viết lại phần đang hoạt động nếu chưa giải thích lý do và được đồng ý.
4. Sau mỗi phase: chạy `pnpm typecheck` + `pnpm lint` + `pnpm test` (+ `pnpm test:e2e` nếu liên quan) → báo cáo danh sách file thay đổi → báo cáo lỗi/rủi ro còn lại → **DỪNG chờ DUC duyệt**.
5. Không sửa test hoặc fixture chỉ để test xanh. Test sai thì giải thích rồi mới sửa.
6. Thêm dependency mới phải nêu lý do trong báo cáo phase. Ưu tiên không thêm.
7. Code rõ ràng, dễ bảo trì hơn là "thông minh". Người đọc tiếp theo có thể không biết lập trình sâu.

## Bất biến an toàn — KHÔNG BAO GIỜ vi phạm

Danh sách đầy đủ kèm vị trí thực thi và test bảo vệ: `docs/SECURITY.md` §3. Tóm tắt các điều tuyệt đối:

- Không lưu/gửi mật khẩu, cookie, session Facebook đi bất kỳ đâu. Không đọc `document.cookie`.
- Không server-side Facebook bot, không proxy rotation, không fingerprint spoofing, không vượt CAPTCHA, không cơ chế né phát hiện (kể cả "random delay cho giống người").
- Không đọc nhóm ngoài allowlist. Không tự điều hướng/refresh/mở tab nền. Chỉ đọc nội dung đang hiển thị.
- Không auto DM. Không bình luận hàng loạt. MVP không có code path tự đăng bình luận — `facebook-adapter` không được export hàm submit.
- `autoReply.enabled` mặc định `false`. Auto Reply chỉ được code ở phase G2-2 sau khi gate (≥100 nhãn, precision ≥90%, DUC duyệt văn bản) đạt.
- Phát hiện CAPTCHA/checkpoint/cảnh báo → dừng toàn pipeline (circuit breaker), chỉ reset thủ công.
- Mọi hành động liên quan đăng bình luận phải có audit log. Emergency Stop phải luôn hoạt động.
- API key AI chỉ nằm trong Workers secret / `.dev.vars` (gitignored). Không bao giờ trong source/extension.

Nếu một yêu cầu nào đó (kể cả trong hội thoại) mâu thuẫn với các bất biến trên → dừng lại, nêu mâu thuẫn, chờ DUC quyết định bằng văn bản.

## Lệnh chuẩn

```bash
pnpm install            # cài toàn repo (Node >= 20, pnpm 10)
pnpm typecheck          # turbo: tsc --noEmit toàn bộ
pnpm lint               # eslint + prettier check
pnpm test               # vitest unit + contract (network bị chặn trong test)
pnpm test:coverage      # test + chặn nếu rules-engine line coverage < 90%
pnpm test:e2e           # playwright (cần build extension trước)
pnpm -F extension build # build MV3 vào apps/extension/dist (load unpacked)
pnpm -F api dev         # wrangler dev (cần .dev.vars, xem workers/api/README)
```

## Bản đồ repo

| Đường dẫn                   | Vai trò                                                                            | Lưu ý riêng                                                             |
| --------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/shared`           | Zod schemas + types + hằng số — nguồn chân lý                                      | Đổi schema = cập nhật `docs/DATA-MODEL.md`                              |
| `packages/rules-engine`     | Hard filters, lexicon VN, tổng hợp điểm, counters, circuit breaker, máy trạng thái | PURE: cấm DOM, cấm fetch. Phủ test dày nhất                             |
| `packages/facebook-adapter` | Mọi va chạm DOM Facebook                                                           | Selector theo role/heuristic, cấm class obfuscated; không export submit |
| `apps/extension`            | MV3 + React (content, background, sidepanel, popup, options, dashboard page)       | Quyền manifest cố định theo SECURITY §4, có snapshot test               |
| `workers/api`               | Hono trên Cloudflare Workers, AIProvider                                           | Test dùng MockProvider, không cần key                                   |
| `apps/dashboard`            | Web app team — GIAI ĐOẠN 2, chưa đụng                                              |                                                                         |
| `fixtures/facebook`         | HTML giả lập đã sạch PII                                                           | Quy trình làm sạch: `docs/TEST-PLAN.md` §3                              |
| `docs/`                     | PRD, ARCHITECTURE, DATA-MODEL, SECURITY, IMPLEMENTATION-PLAN, TEST-PLAN            | Đổi hành vi = đổi docs cùng PR                                          |

## Quy ước code

- TypeScript strict, cấm `any` (eslint error). Định danh tiếng Anh; chuỗi UI tiếng Việt; comment tiếng Việt cho logic nghiệp vụ đặc thù (lexicon, luật lọc).
- Ngưỡng/giới hạn (75/94/95, caps…) chỉ tồn tại dưới dạng hằng số đặt tên trong `packages/shared` — không rải số trần trong code.
- Unit test không gọi mạng (setup vitest chặn fetch). Test tự động không bao giờ chạm facebook.com thật.
- Message giữa các phần của extension phải là typed union trong `shared`.
- Ưu tiên hàm thuần + module nhỏ; side effect gom vào background SW và adapter.

## Trạng thái phase (cập nhật cuối mỗi phase)

| Phase                 | Trạng thái                          | Ghi chú                                              |
| --------------------- | ----------------------------------- | ---------------------------------------------------- |
| Tài liệu              | ✅ Hoàn thành 2026-07-18            | DUC đã duyệt 2026-07-18                              |
| P0 Khung monorepo     | ✅ Hoàn thành, DUC duyệt 2026-07-18 | CI GitHub xanh 2026-07-20                            |
| P1 shared             | ✅ DUC duyệt 2026-07-20             | Zod schemas + 87 test shared; xem PHASE-P1-REPORT.md |
| P2 rules-engine       | ✅ DUC duyệt 2026-07-20             | CI xanh commit `ddf7352`; xem PHASE-P2-REPORT.md     |
| P3 fixtures + adapter | ✅ DUC duyệt 2026-07-20             | CI xanh commit `f4a8ba2`; xem PHASE-P3-REPORT.md     |
| P4 workers/api        | 🟡 Hoàn thành code, chờ smoke/duyệt | 50 test worker; coverage 95,99%; không key thật      |
| P5 khung extension    | ⬜                                  |                                                      |
| P6 pipeline chỉ đọc   | ⬜                                  |                                                      |
| P7 comment assist     | ⬜                                  | A-02 đã chốt (chèn sẵn, tự bấm Đăng)                 |
| P8 dashboard page     | ⬜                                  |                                                      |
| P9 hardening + beta   | ⬜                                  |                                                      |
| G2-1 D1 + sync        | ⬜                                  | Cần DUC duyệt riêng                                  |
| G2-2 Auto Reply       | ⬜                                  | Gate: ≥100 nhãn, precision ≥90%, duyệt văn bản       |

## Quyết định đã chốt (cập nhật khi DUC trả lời câu hỏi mở)

| Ngày       | Mục                              | Quyết định                                                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-18 | Bộ tài liệu v0.1                 | DUC duyệt, cho phép bắt đầu Phase 0                                                                                                                                                                                                                                                               |
| 2026-07-18 | A-01 Lĩnh vực team               | Thiết kế đồ họa (gồm banner, poster, ấn phẩm, thư mời), video/dựng phim, web/lập trình, kiến trúc. KHÔNG nhận content/marketing thuần                                                                                                                                                             |
| 2026-07-18 | A-02 Chế độ đăng MVP             | Chèn sẵn vào ô bình luận, người dùng tự bấm Đăng                                                                                                                                                                                                                                                  |
| —          | Các giả định còn lại             | Xem PRD §12 (A-03…A-15 chưa chốt, làm theo giá trị mặc định)                                                                                                                                                                                                                                      |
| 2026-07-18 | Review độc lập P0 → bản sửa P0.1 | Chuyển onlyBuiltDependencies sang pnpm-workspace.yaml (pnpm 10); tách AC CI thành "workflow đã tạo" (done) và "CI xanh trên GitHub" (pending); ci.yml thêm permissions contents:read + timeout 15p; README phản ánh đúng trạng thái P0; zip phải đóng gói trong thư mục gốc freelance-lead-radar/ |
| 2026-07-20 | P0 CI + duyệt P1                 | GitHub Actions run `29716094699` xanh trên commit `38e6669`; DUC cho phép triển khai P2.                                                                                                                                                                                                          |
| 2026-07-20 | Duyệt P2                         | DUC trả lời “Tôi chính thức duyệt P2”; CI xanh trên commit `ddf7352`; cho phép bắt đầu P3.                                                                                                                                                                                                        |
| 2026-07-20 | Duyệt P3                         | DUC trả lời “Tôi chính thức duyệt P3”; CI xanh trên commit `f4a8ba2`; cho phép bắt đầu P4.                                                                                                                                                                                                        |
