# Hướng dẫn dựng AI miễn phí (Cloudflare Workers AI) — cho người không biết code

Mục tiêu: để extension chấm điểm bài và soạn nháp bằng AI **miễn phí, luôn bật**, không cần mở terminal mỗi ngày. Chạy một lần các bước dưới đây là xong.

Miễn phí thế nào: Cloudflare cho 10.000 lượt AI/ngày trên gói Free. Quy mô của anh (vài chục bài/ngày) còn cách rất xa. Nếu lỡ vượt, nó **báo lỗi và dừng tới hôm sau, KHÔNG tự trừ tiền** — không lo hóa đơn bất ngờ.

Tất cả lệnh gõ trong **Git Bash** mở tại thư mục `freelance-lead-radar-git` (chuột phải trong thư mục → "Git Bash Here"). Copy từng ô, dán, Enter, chờ xong mới sang ô kế.

---

## Bước 1 — Tạo tài khoản Cloudflare (miễn phí, không cần thẻ)

Vào `https://dash.cloudflare.com/sign-up`, đăng ký bằng email, xác nhận email. Xong, không cần làm gì thêm trong trang này.

## Bước 2 — Đăng nhập Cloudflare từ máy

```
pnpm --filter @flr/api exec wrangler login
```

Trình duyệt sẽ mở ra, bấm nút **Allow** (Cho phép). Quay lại Git Bash thấy chữ "Successfully logged in" là được.

## Bước 3 — Lấy mã ID của extension

Mở Chrome → gõ `chrome://extensions` → tìm thẻ **Freelance Lead Radar** → copy dòng **ID** (32 chữ thường, ví dụ `abcdefgh...`).

## Bước 4 — Dán ID đó vào file cấu hình

Mở file `workers\api\wrangler.toml` bằng Notepad. Tìm đúng dòng này (ở khối `[env.free.vars]`):

```
EXTENSION_ORIGIN = "chrome-extension://REPLACE_WITH_EXTENSION_ID"
```

Thay `REPLACE_WITH_EXTENSION_ID` bằng ID vừa copy, thành ví dụ:

```
EXTENSION_ORIGIN = "chrome-extension://abcdefgh...."
```

Giữ nguyên dấu ngoặc kép và chữ `chrome-extension://`. Lưu file (Ctrl+S).

## Bước 5 — Tạo mật khẩu kết nối (TEAM_TOKEN)

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Nó in ra một chuỗi dài 64 ký tự. **Copy và dán tạm vào Notepad để lát dùng.**

## Bước 6 — Cài mật khẩu đó lên Cloudflare

```
pnpm --filter @flr/api exec wrangler secret put TEAM_TOKEN --env free
```

Nó hỏi "Enter a secret value" → dán chuỗi 64 ký tự ở Bước 5 vào → Enter.

## Bước 7 — Đưa lên mạng (deploy)

```
pnpm --filter @flr/api exec wrangler deploy --env free
```

- Lần đầu nó có thể hỏi đặt "workers.dev subdomain" → gõ Enter để nhận tên mặc định.
- Nếu nó báo cần bật Workers AI → mở `https://dash.cloudflare.com`, vào mục **AI → Workers AI**, bấm đồng ý một lần, rồi chạy lại lệnh deploy.

Chạy xong, dòng gần cuối in ra **địa chỉ** dạng:

```
https://freelance-lead-radar-api-free.<tên-của-anh>.workers.dev
```

**Copy địa chỉ này.**

## Bước 8 — Kiểm tra AI đã sống

Mở trình duyệt, dán địa chỉ trên rồi thêm `/v1/health` vào cuối, ví dụ:

```
https://freelance-lead-radar-api-free.<tên-của-anh>.workers.dev/v1/health
```

Thấy `{"ok":true,"schemaVersion":1}` là AI đã chạy trên mạng, miễn phí, luôn bật.

## Bước 9 — Điền vào extension

Mở **Options** của extension (như các lần trước), điền:

- **API Base URL** = địa chỉ ở Bước 7 (KHÔNG kèm `/v1/health`).
- **TEAM_TOKEN** = chuỗi 64 ký tự ở Bước 5.
- **Hồ sơ năng lực ngắn** = 2–3 câu thật về team (để AI soạn nháp không bịa).

Bấm **Lưu toàn bộ cài đặt**.

## Bước 10 — Thử thật

1. Máy Windows: tắt Focus Assist / Do Not Disturb (để thấy thông báo).
2. Tự đăng vào nhóm test một bài mẫu, ví dụ: _"Cần thuê 1 bạn thiết kế logo + banner, có budget, cần gấp, ib mình"_.
3. Mở tab nhóm test, lướt tới bài đó.
4. Chờ vài giây → **thông báo desktop hiện ra** + số đếm trên icon extension. Bấm thông báo → mở đúng bài.

Xong. Từ nay không cần mở terminal nữa — AI luôn chạy trên Cloudflare.

---

## Nếu cần chỉnh về sau

- **AI báo hết lượt trong ngày**: chờ qua 7 giờ sáng (giờ VN) là reset, hoặc đổi sang model rẻ hơn (xem dưới).
- **Chất lượng chấm điểm / nháp chưa ưng**: model miễn phí yếu tiếng Việt hơn Claude. Mở `wrangler.toml`, ở khối `[env.free.vars]` đổi `WORKERS_AI_CLASSIFY_MODEL` sang `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (chất lượng cao hơn), lưu, rồi chạy lại Bước 7. Danh sách model hiện có: `https://developers.cloudflare.com/workers-ai/models/`.
- **Đổi lại sang bản trả phí Claude** (chất lượng cao nhất): dùng khối `[env.production]` và lệnh `wrangler deploy --env production` — hướng dẫn trong `workers/api/README.md`.

## Lưu ý quan trọng

- Mật khẩu TEAM_TOKEN chỉ nằm trong Cloudflare (Bước 6) và trong Options trên máy anh — không bao giờ ghi vào code.
- Bản miễn phí này **không cần API key AI của bên nào cả** — an toàn hơn, không có key để lộ.
- Nếu ID extension đổi (do di chuyển thư mục dự án), phải sửa lại Bước 4 và deploy lại Bước 7.
