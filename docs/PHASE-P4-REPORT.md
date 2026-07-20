# BÁO CÁO PHASE P4 — WORKERS API

Ngày: 2026-07-20  
Trạng thái: Hoàn thành code + QA tự động; chờ smoke test `wrangler dev` trên máy DUC và nghiệm thu

## 1. Kết quả

P4 thay placeholder `workers/api` bằng Cloudflare Worker stateless:

- Hono app với `GET /v1/health`, `POST /v1/classify` (batch tối đa 10) và `POST /v1/draft`.
- Chuỗi middleware POST đúng thứ tự: Bearer auth constant-time → rate limit 60/phút/token → payload 64KB → zod validate.
- CORS chỉ trả quyền cho đúng `chrome-extension://<EXTENSION_ID>` được cấu hình.
- Request/response dùng schema từ `@flr/shared`; request không có trường cookie/session/credential Facebook.
- Error taxonomy chuẩn: 400/401/413/429/502/500, không echo body hoặc secret.
- AI trả JSON sai hoặc provider lỗi được retry đúng một lần; vẫn lỗi → `502 ai_unavailable`.

## 2. Provider và prompt

- `AIProvider` cô lập backend khỏi nhà cung cấp.
- `MockProvider` deterministic dùng cho toàn bộ test và local dev, không cần key, không gọi mạng.
- `AnthropicProvider` dùng `fetch` chuẩn của Workers, timeout 15 giây, model cấu hình bằng env; không thêm SDK Anthropic.
- Prompt classify và draft bằng tiếng Việt, coi nội dung bài là dữ liệu để giảm prompt injection.
- Prompt draft thực thi PRD §9: 2–4 câu, “mình – bạn”, bám nhu cầu, không bịa năng lực, CTA nhẹ, luôn là nháp chờ người duyệt.

## 3. Bảo mật và giới hạn

- TEAM_TOKEN được hash SHA-256 trước khi làm key rate limit; token thô không nằm trong bộ đếm/log.
- Production dùng Cloudflare Rate Limiting binding 60 request/60 giây; fallback trong bộ nhớ chỉ dành cho unit test hoặc môi trường không có binding.
- Logger chỉ nhận `timestamp`, `route`, `method`, `status`, `latencyMs`, `inputBytes`; test spy xác nhận không body/token.
- `check-api-safety.sh` chạy trong CI, chặn Facebook bot/proxy/stealth và dependency browser/proxy phía Worker.
- `wrangler.toml` không có secret; production secret chỉ qua `wrangler secret put`.

Cloudflare ghi rõ Rate Limiting binding có phạm vi theo location và tính permissive/eventual-consistent; vì vậy nó là hàng rào chống lạm dụng, không phải bộ đếm kế toán tuyệt đối.

## 4. Dependency mới

- `hono@4.12.31`: router/middleware Worker nhỏ, đúng kiến trúc đã duyệt.
- `wrangler@4.112.0` (devDependency): build, chạy local và deploy Cloudflare Worker.
- `@flr/shared: workspace:*`: tái sử dụng contract/hằng số, không lặp schema.

Không thêm Anthropic SDK, axios, browser automation hoặc proxy dependency.

Pnpm được cấu hình fail-closed cho lifecycle script: chỉ `esbuild` và runtime
`workerd` được chạy build script; script tùy chọn của `sharp` bị chặn rõ ràng.
Dependency mới có build script nhưng chưa được review sẽ làm `pnpm install` lỗi.

## 5. Test và coverage

- `workers/api`: 50 tests cho route, auth, CORS, rate limit binding/fallback, payload, provider, prompt, retry, logger và output validation.
- Toàn monorepo: 29 test files, 364 tests.
- Workers API line coverage 95,99% (CI chặn dưới 80%).
- Facebook-adapter regression: 97,29% lines.
- Rules-engine regression: 98,17% lines.
- Wrangler dry-run bundle thành công: 237,21 KiB, gzip 47,15 KiB; nhận đúng binding MockProvider/CORS/rate limit.

## 6. Bảng kiểm định cuối

Kiểm định được chạy lại từ bản sao sạch không có `node_modules`, `.turbo`,
`coverage` hoặc `.git`, dùng đúng pnpm 10.28.0 và lockfile đóng băng.

| Hạng mục                         | Kết quả                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | ✅ 245 package; chỉ `esbuild` + `workerd` chạy script đã duyệt                                                    |
| `check-secrets`                  | ✅ Không phát hiện secret                                                                                         |
| `check-api-safety`               | ✅ Không bot/proxy/stealth dependency                                                                             |
| `typecheck`                      | ✅ 6/6 workspace package                                                                                          |
| `lint` + Prettier                | ✅                                                                                                                |
| Unit + contract                  | ✅ 29/29 file, 364/364 test                                                                                       |
| Coverage                         | ✅ tổng 97,39%; Worker 95,99%; adapter 97,29%; rules 98,17%                                                       |
| `pnpm audit --audit-level high`  | ✅ Không có vulnerability đã biết                                                                                 |
| Wrangler dry-run                 | ✅ Bundle và binding hợp lệ; tiến trình telemetry/proxy của sandbox phải bị timeout sau khi Wrangler báo hoàn tất |

Payload thực tế không có `Content-Length` được đọc theo luồng và hủy ngay khi
vượt 64KB, tránh nạp toàn bộ request quá lớn vào bộ nhớ.

## 7. Giới hạn môi trường và smoke test còn lại

Sandbox Codex không được mở network interface local: Wrangler đọc/bundle config thành công nhưng `wrangler dev` dừng ở lỗi hệ thống `uv_interface_addresses`. Đây không phải lỗi TypeScript/Worker; việc bind cổng cần chạy trên máy Windows của DUC.

DUC thực hiện đúng `workers/api/README.md`:

1. Tạo `.dev.vars` từ `.dev.vars.example`.
2. Chạy `pnpm --filter @flr/api dev`.
3. Chạy ba curl mẫu health/classify/draft.
4. Gửi kết quả để chốt acceptance criterion cuối.

## 8. Việc cố tình chưa làm

- Không deploy Worker production và không yêu cầu key Anthropic thật.
- Không gọi Facebook từ server, không lưu bài/lead vào D1.
- Không nối extension với API; thuộc P6 sau khi có khung P5.
- Không có bất kỳ chức năng bình luận/chèn/submit Facebook.
- Không bắt đầu P5.

## 9. Rủi ro còn lại

- Cloudflare rate limit có tính eventual-consistent và theo location; có thể cho qua burst nhỏ.
- Hai model Anthropic production chưa được DUC chốt theo A-03; `wrangler.toml` giữ placeholder rõ ràng để tránh deploy nhầm.
- Cần thay `EXTENSION_ORIGIN` bằng extension ID thật sau P5.
- API mới được test bằng MockProvider; test Anthropic chỉ dùng fetch giả, chưa tiêu tiền hoặc gửi dữ liệu thật.

## 10. Điều kiện nghiệm thu

P4 chỉ được xem là hoàn tất acceptance sau khi smoke test `wrangler dev` + ba curl trên máy DUC xanh và GitHub Actions của commit P4 xanh. Chỉ sau khi DUC trả lời rõ **“Tôi chính thức duyệt P4”** mới được bắt đầu P5.
