# SECURITY — FREELANCE LEAD RADAR

v0.4 — 2026-07-20 — cập nhật theo Phase 3.

Tài liệu này biến "QUY TẮC AN TOÀN TUYỆT ĐỐI" trong spec thành **bất biến có vị trí thực thi cụ thể trong code và test bảo vệ**. Mọi phase triển khai phải đối chiếu bảng §3 trước khi merge.

## 1. Tài sản cần bảo vệ

1. **Tài khoản Facebook của người dùng** — tài sản quý nhất, mất là mất kênh làm ăn.
2. Dữ liệu lead (chứa dữ liệu cá nhân công khai của người đăng: tên, SĐT/Zalo).
3. API key AI và TEAM_TOKEN.
4. Uy tín của team (không được biến thành công cụ spam).

## 2. Mô hình mối đe dọa (tóm tắt)

| Mối đe dọa                                         | Đường vào            | Đối sách chính                                                                                                                          |
| -------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Facebook hạn chế/khóa tài khoản do hành vi tự động | Hành vi extension    | Thiết kế thụ động, human-in-the-loop, giới hạn ngày, circuit breaker, Emergency Stop                                                    |
| Lộ API key AI                                      | Key nằm sai chỗ      | Key CHỈ ở Workers secret; CI có bước grep chặn secret trong repo                                                                        |
| Kẻ khác gọi Workers API "chùa"                     | Endpoint public      | Bearer TEAM_TOKEN so sánh constant-time, rate limit, CORS chỉ nhận extension origin                                                     |
| Trang web độc bơm dữ liệu giả vào extension        | Message spoofing     | Content script chỉ nhận message từ chrome.runtime nội bộ; validate zod mọi message; không dùng `window.postMessage` cho dữ liệu tin cậy |
| Rò rỉ dữ liệu cá nhân trong lead                   | Log, backend, export | Backend không lưu nội dung bài (MVP), log chỉ metadata, retention + purge, export do người dùng chủ động                                |

## 3. Bảng bất biến an toàn (rule → thực thi → test)

Đây là phần quan trọng nhất của tài liệu. **Không PR nào được vi phạm; thay đổi bảng này phải được DUC duyệt bằng văn bản.**

| #   | Bất biến (từ spec)                                       | Thực thi ở đâu                                                                                                              | Test bảo vệ                                                                                           |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Không lưu mật khẩu, cookie, Facebook session trên server | Worker không đọc header Cookie; schema request không có trường credential; extension không đọc `document.cookie`            | ESLint `no-restricted-properties` cấm `document.cookie`; contract test schema request                 |
| 2   | Không server-side Facebook browser bot                   | workers/api không có dependency HTTP-client gọi facebook.com; không puppeteer/playwright trong dependencies production      | CI script kiểm tra dependency + grep `facebook.com` trong workers/src (chỉ được phép trong comment)   |
| 3   | Không proxy rotation                                     | Không tồn tại code/config proxy                                                                                             | Review + CI grep từ khóa (`proxy-rotate`, danh sách proxy)                                            |
| 4   | Không fingerprint spoofing                               | Không can thiệp navigator/UA/canvas                                                                                         | Review + CI grep (`userAgent =`, `navigator.__defineGetter__`…)                                       |
| 5   | Không vượt CAPTCHA/checkpoint                            | Ngược lại: phát hiện là DỪNG (circuit breaker)                                                                              | Unit test `detectWarningSignals` + e2e fixture checkpoint → pipeline dừng                             |
| 6   | Không né cơ chế phát hiện của Facebook                   | Không random delay "giả người", không xoay hành vi; giới hạn tần suất chỉ nhằm an toàn và được ghi rõ                       | Review nguyên tắc; cấm từ khóa kiểu `humanize`/`stealth` trong codebase                               |
| 7   | Không quét nhóm ngoài allowlist                          | Content script hỏi background trước khi gắn observer; background đối chiếu groupId với Settings.allowlist                   | Unit test gate; e2e: fixture nhóm lạ → 0 message POST_SEEN                                            |
| 8   | Không tự động gửi tin nhắn riêng                         | Không tồn tại code path DM ở mọi package                                                                                    | CI grep (`/messages`, `messenger.com` API); review                                                    |
| 9   | Không bình luận hàng loạt                                | Chỉ chèn 1 bình luận/lần theo thao tác duyệt; `minCommentIntervalMin` + `maxCommentsPerDay` trong counters                  | Unit test counters; e2e: duyệt liên tiếp 2 lead trong < interval → lead 2 bị chặn kèm thông báo       |
| 10  | Auto Reply tắt mặc định                                  | `Settings.autoReply.enabled` default `false` trong zod schema; MVP không render UI bật                                      | Snapshot test default settings; test UI không có control autoReply trong MVP                          |
| 11  | Tự dừng khi CAPTCHA/checkpoint/cảnh báo                  | `detectWarningSignals` (adapter) → `WARNING_DETECTED` → circuit breaker `tripped` → chặn 3 lớp; chỉ reset thủ công          | Unit + e2e fixture từng loại tín hiệu                                                                 |
| 12  | Mọi hành động đăng bình luận có audit log                | `comment_inserted` + `comment_confirmed` ghi trong cùng transaction logic với hành động; audit append-only                  | Unit test: chèn comment mà không ghi audit → transition fail                                          |
| 13  | Có Emergency Stop                                        | Toggle ở popup, persist `flr:state.emergencyStop`, kiểm tra tại 3 lớp (content/background/adapter)                          | e2e: bật stop giữa pipeline → không call API, không chèn                                              |
| 14  | Không dùng dữ liệu FB ngoài mục đích xử lý lead hiện tại | Backend MVP stateless với nội dung bài (không ghi D1 khi chưa tới giai đoạn 2); retention purge; không analytics bên thứ ba | Review + test purge                                                                                   |
| 15  | MVP không tự đăng dù ≥ 95 điểm                           | `facebook-adapter` KHÔNG export hàm submit; không listener tự click nút Đăng                                                | Test tĩnh: import surface của adapter không chứa `submit*`; e2e: lead 97 điểm vẫn dừng ở needs_review |

Phase 1 đã triển khai phần schema của các bất biến #1 và #10. Phase 2 bổ sung gate thuần cho allowlist, Emergency Stop, dedupe, daily limit và circuit breaker. Phase 3 triển khai adapter đọc DOM, parser URL, phát hiện checkpoint/CAPTCHA/banner chặn và locator ô bình luận; export surface được khóa bằng allowlist chỉ-đọc, không có fill/submit/click. Enforcement ba lớp và thao tác điền chỉ xuất hiện đúng P5–P9.

## 4. Quyền extension — tối thiểu và giải trình

| Quyền                                          | Vì sao cần                                              | Vì sao đủ                                                |
| ---------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `storage`                                      | Lưu settings, lead, audit local                         | Không cần server trong MVP                               |
| `sidePanel`                                    | UI hàng đợi duyệt                                       | —                                                        |
| `host_permissions: https://www.facebook.com/*` | Content script đọc DOM nhóm allowlist khi người dùng mở | Gate allowlist chạy ngay đầu; ngoài allowlist script ngủ |

Cố tình KHÔNG xin: `tabs`, `cookies`, `webRequest`, `scripting`, `history`, `notifications` (cân nhắc sau), `<all_urls>`. Thêm bất kỳ quyền nào = sửa tài liệu này + DUC duyệt.

## 5. Bảo vệ Workers API

- Auth: `Authorization: Bearer <TEAM_TOKEN>`; token do đội trưởng phát hành khi deploy (wrangler secret), so sánh constant-time. Sai/thiếu → 401, không phân biệt lý do.
- Rate limit: 60 req/phút/token; vượt → 429.
- CORS: chỉ `chrome-extension://<EXTENSION_ID>` (cấu hình qua env var, cập nhật khi có ID chính thức).
- Payload ≤ 64KB; batch ≤ 10 bài/request; zod validate mọi input/output; lỗi validate → 400 kèm mã, không echo dữ liệu vào.
- Timeout gọi AI + retry tối đa 1 lần; lỗi provider → 502 mã `ai_unavailable`, extension hiển thị trạng thái, KHÔNG tự suy diễn điểm.
- Log: timestamp, route, status, latency, độ dài input. **Không log nội dung bài, không log token, không log key.**

## 6. Quản lý secret

| Secret                 | Nơi sống duy nhất                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| API key AI (Anthropic) | `wrangler secret put ANTHROPIC_API_KEY` (production) / `.dev.vars` local (gitignored)                             |
| TEAM_TOKEN             | `wrangler secret put TEAM_TOKEN`; người dùng dán vào Options của extension (lưu chrome.storage.local trên máy họ) |

Quy tắc: repo không có `.env` thật (chỉ `.dev.vars.example` với giá trị giả); `.gitignore` chặn `.dev.vars`, `.env*`; CI có bước grep pattern key (`sk-ant-`, `Bearer ey`) — build fail nếu dính.

## 7. Dữ liệu cá nhân — Nghị định 13/2023/NĐ-CP (Việt Nam)

Lead chứa dữ liệu cá nhân công khai của người đăng (tên, SĐT/Zalo họ tự đăng kèm lời mời liên hệ). Đối xử như sau:

- **Mục đích giới hạn**: chỉ dùng để team liên hệ nhận việc đúng lời mời công khai của chính người đăng. Không bán, không chia sẻ, không dùng chạy quảng cáo/marketing list.
- **Tối thiểu hóa**: chỉ trường trong DATA-MODEL; không thu thập gì về người không liên quan.
- **Thời hạn**: retention mặc định 90 ngày, tự purge; nút xóa từng lead và xóa toàn bộ.
- **Lưu trữ MVP**: toàn bộ trên máy người dùng (chrome.storage.local). Giai đoạn 2 đưa lên D1 phải rà lại mục này (mã hóa at-rest mặc định của Cloudflare + access control).

## 8. Nói thẳng về rủi ro điều khoản Facebook

Kể cả với thiết kế thụ động và human-in-the-loop, một công cụ đọc DOM và hỗ trợ soạn/chèn bình luận **vẫn có thể bị Facebook coi là vi phạm điều khoản về thu thập tự động và tương tác tự động**. Hệ quả có thể là hạn chế tính năng, yêu cầu xác minh, hoặc khóa tài khoản. Dự án giảm thiểu (không loại bỏ) rủi ro này bằng: đọc thụ động, không hành vi nền, giới hạn ngày thấp, con người bấm Đăng, tự dừng khi có cảnh báo. **Người dùng cần hiểu và chấp nhận rủi ro tồn dư trước khi dùng; điều này phải hiển thị trong onboarding của extension (P9) và là lý do Auto Reply bị gate nghiêm ngặt.** Không có hạng mục nào trong dự án được phép "làm giảm khả năng Facebook phát hiện" — hướng xử lý duy nhất khi bị cảnh báo là DỪNG.

## 9. Circuit breaker — đặc tả

Tín hiệu kích hoạt (adapter `detectWarningSignals`): URL chứa `/checkpoint`; hộp thoại CAPTCHA/hCaptcha; banner "Bạn tạm thời bị chặn" / "You're temporarily blocked" / "Thử lại sau"; chuyển hướng bất thường sang trang đăng nhập.

Hành vi khi trip: (1) dừng extract + hủy hàng đợi gọi AI + vô hiệu nút chèn bình luận ngay lập tức; (2) ghi audit `circuit_tripped` kèm lý do; (3) banner đỏ trong side panel/popup hướng dẫn người dùng tự kiểm tra tài khoản bằng tay; (4) chỉ người dùng reset thủ công (`circuit_reset`), không tự hồi.

## 10. Audit log và Emergency Stop

- Audit append-only (DATA-MODEL §2.6); export JSON/CSV để đối chiếu; mọi sự kiện đăng bình luận bắt buộc có mặt (bất biến #12).
- Emergency Stop: một toggle, hiệu lực < 1 giây, chặn ở 3 lớp độc lập; trạng thái persist qua restart trình duyệt; bật/tắt đều ghi audit.

## 11. An toàn chuỗi cung ứng

- Khóa version bằng lockfile; hạn chế dependency mới (thêm phải nêu lý do trong PR — quy tắc trong CLAUDE.md).
- Không remote code trong extension (MV3 cấm sẵn); không `eval`; CSP mặc định MV3.
- `pnpm audit` chạy trong CI ở mức cảnh báo; nâng chặn ở giai đoạn 2.
