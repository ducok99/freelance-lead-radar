# IMPLEMENTATION-PLAN — FREELANCE LEAD RADAR

v0.4 — 2026-07-20 — P0–P2 đã duyệt; P3 hoàn thành local, chờ DUC nghiệm thu.

## 1. Nghi thức bắt buộc sau MỖI phase (theo yêu cầu của DUC)

Kết thúc mỗi phase, người thực hiện (Claude hoặc dev) PHẢI:

1. Chạy `pnpm typecheck` — toàn repo xanh.
2. Chạy `pnpm lint` — toàn repo xanh.
3. Chạy `pnpm test` (và `pnpm test:e2e` từ P5 trở đi khi phase có thay đổi liên quan).
4. Báo cáo **danh sách file đã thay đổi** (thêm/sửa/xóa).
5. Báo cáo **lỗi còn lại, rủi ro còn lại, và việc cố tình chưa làm**.
6. **DỪNG. Chờ DUC duyệt bằng chữ "duyệt" (hoặc yêu cầu sửa) mới sang phase kế.**

Quy tắc chung: không mở rộng tính năng ngoài phạm vi phase; không xóa/viết lại phần đang hoạt động nếu chưa giải thích và được đồng ý; không sửa test/fixture chỉ để test xanh; mọi bất biến trong SECURITY.md §3 áp dụng cho mọi phase.

## 2. Tổng quan các phase

| Phase | Tên                                                             | Phụ thuộc           | Cỡ  | Cần chốt trước                                          |
| ----- | --------------------------------------------------------------- | ------------------- | --- | ------------------------------------------------------- |
| P0    | Khung monorepo + toolchain                                      | —                   | S   | —                                                       |
| P1    | packages/shared: schemas + hằng số                              | P0                  | S–M | —                                                       |
| P2    | packages/rules-engine + lexicon tiếng Việt                      | P1                  | M   | A-01 ✅ đã chốt 2026-07-18                              |
| P3    | fixtures/facebook + facebook-adapter (extract)                  | P1                  | M–L | —                                                       |
| P4    | workers/api: classify + draft (Mock + Anthropic)                | P1                  | M   | A-03 mặc định                                           |
| P5    | Khung extension MV3 + gating + Emergency Stop                   | P1–P3               | M   | —                                                       |
| P6    | Pipeline end-to-end CHỈ ĐỌC (chưa chèn bình luận)               | P2–P5               | L   | —                                                       |
| P7    | Comment assist (chèn vào ô, người dùng tự Đăng) + giới hạn ngày | P6                  | M   | A-02 ✅ đã chốt: chèn sẵn, tự bấm Đăng                  |
| P8    | Dashboard page: pipeline, phân công, nhãn precision, export     | P6                  | M   | —                                                       |
| P9    | Hardening: circuit breaker, retention, hướng dẫn, đóng gói beta | P7, P8              | M   | —                                                       |
| G2-1  | Giai đoạn 2: D1 + sync + dashboard team                         | MVP xong            | L   | Duyệt riêng                                             |
| G2-2  | Giai đoạn 2: Auto Reply có kiểm soát                            | G2-1 + gate dữ liệu | M   | **Gate 100 nhãn + precision ≥ 90% + DUC duyệt văn bản** |

MVP = P0 → P9. Ước lượng cỡ: S ≈ nửa ngày, M ≈ 1–2 ngày, L ≈ 2–4 ngày làm việc tập trung (thô, để lập lịch tương đối).

## 3. Chi tiết từng phase

### P0 — Khung monorepo + toolchain

**Phạm vi**: pnpm workspaces, turbo, tsconfig.base strict, ESLint flat config + Prettier, Vitest cấu hình gốc, khung thư mục đúng ARCHITECTURE §3 (mỗi package có `src/index.ts` rỗng + 1 test hello), CI GitHub Actions (typecheck → lint → test), script grep chống secret, `.gitignore`, `.dev.vars.example`.
**Ngoài phạm vi**: mọi logic nghiệp vụ; dependency nặng của từng app (React, wrangler, CRXJS cài ở phase của chúng).

**Acceptance criteria**:

- [x] `pnpm install && pnpm typecheck && pnpm lint && pnpm test` xanh trên máy sạch (Node ≥ 20). ✅ 2026-07-18: Node 22 + pnpm 10, 7 test file / 11 test xanh.
- [x] Cây thư mục khớp ARCHITECTURE §3 (kể cả `fixtures/facebook/` rỗng có README).
- [x] ESLint có rule cấm `document.cookie` và cấm `eval` hoạt động (có test lint fixture vi phạm → fail). ✅ tests/eslint-safety.test.ts.
- [x] CI workflow đã được tạo (`.github/workflows/ci.yml`: permissions tối thiểu `contents: read`, `timeout-minutes: 15`, thứ tự install → check-secrets → typecheck → lint → test, không deployment/external secrets). Bước grep secret đã kiểm chứng local: thêm chuỗi `sk-ant-` giả → exit 1; gỡ ra → pass.
- [x] CI đã chạy xanh trên GitHub Actions — run `29716094699`, commit `38e6669`, ngày 2026-07-20.
- [x] Không có `any` (tsconfig `strict` + `noImplicitAny`; eslint `@typescript-eslint/no-explicit-any: error`).

### P1 — packages/shared

**Phạm vi**: toàn bộ zod schemas + enums + hằng số theo DATA-MODEL.md (Settings, TeamMember, RawPost, Lead, Extraction, AuditEvent, CounterState, SystemState, FilterReason, Classification, LeadStatus, message types, API request/response), `SCHEMA_VERSION = 1`, ngưỡng `{75, 94, 95}` và giới hạn mặc định A-08 dưới dạng hằng số đặt tên.
**Acceptance criteria**:

- [x] Schema có test parse hợp lệ + không hợp lệ: P1 nâng toàn repo lên 97 test, trong đó 87 test thuộc `packages/shared`.
- [x] `Settings.autoReply.enabled` default `false` — có test snapshot (bất biến an toàn #10).
- [x] Type export 100% infer từ zod; không định nghĩa type nghiệp vụ lặp tay.
- [x] `DATA-MODEL.md` cập nhật v0.2: `schemaVersion` cho Audit/Counter, API/message contracts và bảo vệ AuditDetail.
- [x] DUC duyệt P1 và cho phép bắt đầu P2 ngày 2026-07-20.

### P2 — packages/rules-engine

**Phạm vi**: lexicon tiếng Việt (thuê / tìm việc / full-time / spam / làm-thử-miễn-phí / không-thuê-ngoài / CTV heuristic), `gate()` quyết định gửi AI, `hardFilters()` 2 giai đoạn trả `FilterReason[]`, `aggregateScore()` deterministic + điều chỉnh + trần confidence < 0.85 → cap 94, `counters` (giới hạn ngày, reset theo Asia/Bangkok), `circuitBreaker` state machine, `transition()` máy trạng thái Lead.
**Acceptance criteria**:

- [x] 161 unit test trong package; mỗi FilterReason có ≥ 2 test dương + ≥ 2 test âm.
- [x] Bộ 40 bài mẫu tiếng Việt gán nhãn tay: gate + hard filter pre-AI đúng 40/40 (100%).
- [x] `aggregateScore` có test bảng: tổng thành phần đúng, cap 94 khi confidence 0.84, không cap khi 0.85, không âm, không vượt 100.
- [x] Counters: test vượt 10 bình luận/ngày → `daily_limit_reached`; khoảng cách < 5 phút → chặn; reset sang ngày mới theo Asia/Bangkok.
- [x] `transition()` từ chối transition ngoài máy trạng thái; test đủ 11 cạnh hợp lệ và các cạnh cấm đại diện.
- [x] Package cấm DOM/fetch/`Math.random` bằng ESLint riêng; test an toàn xác nhận các rule hoạt động; Vitest chặn network toàn cục.
- [x] Rules-engine line coverage 98,17%; CI chặn nếu xuống dưới 90%.
- [x] DUC chính thức duyệt P2; GitHub Actions xanh trên commit `ddf7352` ngày 2026-07-20.

### P3 — fixtures/facebook + facebook-adapter (extract)

**Phạm vi**: ≥ 8 fixture HTML đã làm sạch PII (bài text thường; bài "Xem thêm" truncated; poster ẩn danh; bài kèm ảnh; bài share lại; bài có SĐT/Zalo; feed nhiều bài xen quảng cáo; trang permalink 1 bài + ô bình luận). `extractPost`, `parsePostKey` (≥ 6 dạng URL có test), `detectWarningSignals` (fixture checkpoint/captcha/banner chặn), locator ô bình luận.
**Acceptance criteria**:

- [x] 100% fixture extract đủ trường bắt buộc (`postKey`, `text`, `permalink`); trường optional thiếu được bỏ theo schema P1, không throw.
- [x] Fixture layout bị cắt xén trả `ExtractionFailure` mã `missing_permalink`, không throw.
- [x] `parsePostKey` đúng 7 dạng URL; URL rác, sai host/protocol/tham số → `null`.
- [x] Adapter chỉ export allowlist P3 chỉ-đọc; không có hàm submit/publish/click/fill comment (test tĩnh — bất biến #15).
- [x] README fixtures ghi checklist làm sạch PII, danh mục và quy tắc selector theo TEST-PLAN §3.
- [x] 12 fixture HTML đều có `.meta.json`; 55 test adapter; line coverage 97,29% (CI chặn dưới 80%).

### P4 — workers/api

**Phạm vi**: Hono app + middleware (bearer auth constant-time, rate limit 60/phút, size limit 64KB, zod validate, CORS extension-origin), `/v1/health`, `/v1/classify` (batch ≤ 10), `/v1/draft`, `AIProvider` + `MockProvider` + `AnthropicProvider`, prompts tiếng Việt (phân loại + soạn nháp theo nguyên tắc PRD §9), error taxonomy, `wrangler.toml` sạch secret.
**Acceptance criteria**:

- [ ] Toàn bộ test chạy với MockProvider, không cần key thật, không gọi mạng (vitest chặn network).
- [ ] Contract test: request/response validate đúng schema shared; response AI hỏng JSON → retry 1 lần → 502 `ai_unavailable`.
- [ ] Thiếu/sai token → 401; quá rate → 429; payload > 64KB → 413; batch > 10 → 400 (mỗi case có test).
- [ ] `wrangler dev` chạy local với `.dev.vars` (hướng dẫn trong README worker); curl mẫu hoạt động.
- [ ] Grep CI xác nhận không secret; không log body (review + test logger).

### P5 — Khung extension MV3

**Phạm vi**: manifest quyền tối thiểu (SECURITY §4), background SW với state persist (Emergency Stop, counters đọc/ghi storage), content script gating (hỏi allowlist + stop trước khi gắn observer), messaging typed, side panel shell (danh sách rỗng), popup (trạng thái + Emergency Stop), options (allowlist CRUD, team skills, thành viên, token, giới hạn hiển thị), build + load unpacked được.
**Acceptance criteria**:

- [ ] `pnpm -F extension build` ra `dist/` load unpacked OK trên Chrome (kèm hướng dẫn từng bước có ảnh chụp màn hình trong README extension).
- [ ] Unit test gating: nhóm ngoài allowlist → không gắn observer, không message nào phát ra; Emergency Stop bật → tương tự.
- [ ] e2e Playwright đầu tiên: load extension + fixture page nhóm-ngoài-allowlist → 0 sự kiện POST_SEEN (bất biến #7).
- [ ] Emergency Stop persist qua restart SW (test mô phỏng SW bị kill: đọc lại từ storage).
- [ ] Manifest snapshot test: đúng danh sách quyền đã duyệt — thêm quyền là test fail.

### P6 — Pipeline end-to-end CHỈ ĐỌC

**Phạm vi**: nối toàn chuỗi: observer → extract → dedupe → hard filter pre-AI → batch gọi API (URL + token từ Settings) → hard filter post-AI + aggregate score → LeadStore → side panel hiển thị lead (điểm, breakdown, phân loại, trích xuất, nháp, giải thích) → hành động Duyệt (chỉ đổi trạng thái `approved`) / Bỏ qua / Sửa nháp → audit log đầy đủ → badge điểm trên bài trong feed (shadow DOM). **Chưa có bất kỳ thao tác ghi nào lên Facebook.**
**Acceptance criteria**:

- [ ] e2e Playwright: từ fixture feed 10 bài (trộn đủ 4 loại) + MockProvider (server test local) → side panel hiển thị đúng N lead kỳ vọng với điểm đúng như mock; bài < 75 không hiện; bài spam/tìm việc/full-time bị loại kèm lý do xem được ở dashboard tab "đã loại".
- [ ] Dedupe: chạy lại fixture lần 2 → 0 call API mới (test đếm request).
- [ ] Sửa nháp → lưu `editedText`, audit `draft_edited`.
- [ ] Mọi sự kiện pipeline có audit tương ứng (test đối chiếu số lượng).
- [ ] Mất mạng/API lỗi → lead ở trạng thái lỗi có thể retry tay, không crash, không mất dữ liệu.

### P7 — Comment assist (A-02 đã chốt: chèn sẵn, người dùng tự bấm Đăng)

**Phạm vi** (theo giả định A-02 — chế độ "điền sẵn, người dùng tự Đăng"): nút "Chèn bình luận" chỉ hoạt động khi bài tương ứng đang mở trong tab; adapter điền `finalComment` vào ô bình luận; theo dõi DOM xác nhận bình luận đã xuất hiện → `comment_confirmed`, status `commented`; enforcement giới hạn: `maxCommentsPerDay`, `minCommentIntervalMin`, chặn khi Emergency Stop/circuit breaker; audit đủ chuỗi `approved → comment_inserted → comment_confirmed`.
**Acceptance criteria**:

- [ ] e2e fixture permalink: duyệt lead → bấm Chèn → ô bình luận chứa đúng nội dung đã sửa; KHÔNG có click submit tự động (kiểm tra nút Đăng chưa được kích hoạt bởi extension).
- [ ] Chèn lead thứ 2 trong vòng < 5 phút → bị chặn + thông báo lý do + audit `filtered` với `daily_limit_reached`.
- [ ] Đạt 10 bình luận trong ngày (mô phỏng counters) → nút Chèn vô hiệu toàn bộ, tooltip giải thích.
- [ ] Bài đã `commented` → mọi nút hành động biến mất vĩnh viễn (dedupe #9 của spec).
- [ ] Emergency Stop bật giữa chừng → lệnh chèn đang chờ bị hủy (test race đơn giản).

### P8 — Dashboard page trong extension

**Phạm vi**: bảng pipeline theo trạng thái (needs_review / approved / commented / assigned / won / lost / skipped / đã loại), phân công thành viên + gợi ý theo khớp `skills` với `extraction.field`, UI dán nhãn Đúng/Sai lead + màn hình thống kê precision (số nhãn, precision hiện tại, tiến độ tới gate 100 nhãn & 90%), xem audit log, export JSON/CSV, nút xóa lead / xóa toàn bộ.
**Acceptance criteria**:

- [ ] Test tính precision: bộ nhãn giả 20 bản ghi → công thức đúng (`correct / (correct + incorrect)`, bỏ qua chưa nhãn).
- [ ] Gợi ý phân công: lead `video_editing` → chỉ gợi ý thành viên có skill đó (test).
- [ ] Export JSON/CSV mở được, đúng số cột đã định nghĩa (test parse lại file export).
- [ ] Màn hình gate Auto Reply hiển thị "chưa đủ điều kiện" khi < 100 nhãn hoặc precision < 90% (chỉ hiển thị trạng thái — không có nút bật).
- [ ] Xóa lead → biến mất khỏi store + dedupe giữ `postKey` (để không xử lý lại bài đó) + audit `data_purged`.

### P9 — Hardening + đóng gói beta

**Phạm vi**: circuit breaker end-to-end (P3 signals → chặn 3 lớp → banner đỏ → reset tay), retention purge tự động theo `retentionDays`, quota guard chrome.storage (cảnh báo + purge lead terminal cũ), màn hình onboarding nêu rủi ro ToS (SECURITY §8) yêu cầu người dùng xác nhận lần đầu, `HUONG-DAN-SU-DUNG.md` cho người không chuyên (cài đặt, cấu hình, quy trình duyệt, xử lý khi thấy banner đỏ), đóng gói zip phát hành nội bộ, checklist smoke test live (TEST-PLAN §7) chạy bởi DUC.
**Acceptance criteria**:

- [ ] e2e: fixture checkpoint xuất hiện giữa phiên → trong < 1 giây: ngừng extract, hủy queue API, vô hiệu nút Chèn; audit `circuit_tripped`; reset chỉ bằng nút xác nhận tay.
- [ ] Test purge: lead quá `retentionDays` bị xóa khi mở extension; dedupe prune tương ứng.
- [ ] Onboarding chưa xác nhận → pipeline không chạy.
- [ ] DUC hoàn thành checklist smoke live trên 1 nhóm test và ký xác nhận trong báo cáo phase.
- [ ] **Beta bắt đầu: mục tiêu thu ≥ 100 nhãn.** Từ đây theo dõi precision hàng tuần trên dashboard.

### G2-1 — Giai đoạn 2: D1 + đồng bộ + dashboard team (cần DUC duyệt riêng trước khi bắt đầu)

**Phạm vi**: migrations D1 theo DATA-MODEL §6, endpoints CRUD + sync (batched upsert theo `updated_at`), `ApiLeadStore`, apps/dashboard standalone (auth đơn giản cho thành viên — phương án chốt ở đầu phase), chế độ offline-first (local vẫn chạy khi mất mạng).
**Acceptance criteria** (phác thảo, chi tiết hóa khi mở phase): sync 2 chiều đúng trên miniflare/D1 local có test xung đột; extension hoạt động bình thường khi API down; rà lại SECURITY §7 cho dữ liệu trên server; không thay đổi hành vi phía Facebook.

### G2-2 — Giai đoạn 2: Auto Reply có kiểm soát

**Điều kiện mở phase (gate cứng, kiểm tra được trên dashboard)**: ≥ 100 lead đã dán nhãn TRONG VẬN HÀNH THẬT **và** precision ≥ 90% **và** DUC phê duyệt bằng văn bản trong issue/PR mở phase.
**Phạm vi**: cờ `autoReply.enabled` có UI bật (mặc định OFF, kèm cảnh báo rủi ro phải xác nhận); điều kiện từng bài: `autoEligible` (score ≥ 95, confidence ≥ 0.85) + bài đang hiển thị trong tab người dùng đang mở + không trùng + trong giới hạn ngày/khoảng cách + không có cảnh báo nào; mỗi lần auto-post: thông báo cho người dùng + audit `autoreply_posted`; bất kỳ tín hiệu cảnh báo nào → tự tắt `autoReply.enabled` + circuit breaker.
**Acceptance criteria** (phác thảo): e2e đầy đủ các nhánh chặn; kill switch < 1 giây; auto-tắt khi trip; báo cáo tuần đầu vận hành kèm audit đối chiếu 100%.

## 4. Definition of Done chung cho mọi phase

1. Acceptance criteria của phase: đủ, có bằng chứng (output test/ảnh chụp).
2. `pnpm typecheck` + `pnpm lint` + `pnpm test` (+ e2e nếu liên quan) xanh.
3. Không vi phạm bất kỳ dòng nào trong SECURITY.md §3.
4. Tài liệu trong `docs/` cập nhật nếu hành vi/schema đổi.
5. CLAUDE.md bảng trạng thái phase được cập nhật.
6. Báo cáo phase: file thay đổi + rủi ro còn lại + việc cố tình chưa làm.
7. Đã DỪNG và được DUC duyệt.

## 5. Chi phí vận hành dự kiến (thô — cần đối chiếu bảng giá hiện hành, xem A-15)

- Cloudflare Workers: quy mô MVP nằm gọn trong free tier (< 100k request/ngày).
- AI (quy mô A-12: ~200 classify + ~30 draft/ngày): model nhỏ cho classify + model vừa cho draft → ước tính **~1–2 USD/ngày trần**, thường thấp hơn nhiều nhờ gate từ khóa local chặn phần lớn bài rác trước khi gọi AI.
- D1: giai đoạn 2, free tier đủ cho quy mô team.
