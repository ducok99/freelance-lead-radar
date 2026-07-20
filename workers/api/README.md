# @flr/api — Cloudflare Workers backend

P4 cung cấp API stateless cho phân loại lead và soạn bình luận nháp. Worker không gọi Facebook, không nhận cookie/session Facebook và không lưu nội dung bài.

## Endpoint

| Method | Route          | Auth              | Mô tả                    |
| ------ | -------------- | ----------------- | ------------------------ |
| GET    | `/v1/health`   | Không             | Kiểm tra Worker sống     |
| POST   | `/v1/classify` | Bearer TEAM_TOKEN | Phân loại batch 1–10 bài |
| POST   | `/v1/draft`    | Bearer TEAM_TOKEN | Soạn một bình luận nháp  |

Middleware áp dụng cho POST: bearer auth constant-time → 60 request/phút/token qua Cloudflare Rate Limiting binding → payload tối đa 64KB → zod validate. CORS chỉ trả header cho `EXTENSION_ORIGIN` chính xác. Unit test không có binding sẽ dùng bộ đếm cô lập trong bộ nhớ.

## Chạy local an toàn bằng MockProvider

Từ thư mục gốc repo:

```bash
cp workers/api/.dev.vars.example workers/api/.dev.vars
pnpm --filter @flr/api dev
```

MockProvider không cần key Anthropic và không gọi mạng. Mặc định Wrangler mở `http://localhost:8787`.

Health:

```bash
curl http://localhost:8787/v1/health
```

Classify:

```bash
curl -X POST http://localhost:8787/v1/classify \
  -H "Authorization: Bearer local_only_change_this_token" \
  -H "Content-Type: application/json" \
  -H "Origin: chrome-extension://test-extension-id" \
  --data '{"posts":[{"postKey":"1234567890:9876543210","text":"Cần bạn edit 10 video TikTok","anonymousPoster":false,"truncated":false}],"teamSkills":["video_editing"]}'
```

Draft:

```bash
curl -X POST http://localhost:8787/v1/draft \
  -H "Authorization: Bearer local_only_change_this_token" \
  -H "Content-Type: application/json" \
  -H "Origin: chrome-extension://test-extension-id" \
  --data '{"postKey":"1234567890:9876543210","postText":"Cần bạn edit 10 video TikTok","extraction":{"jobSummary":"Edit 10 video TikTok","field":"video_editing","tools":[],"contacts":[]},"score":88,"teamProfile":"Team chuyên dựng video ngắn."}'
```

## Production Anthropic

1. Thay ba placeholder trong `[env.production.vars]` của `wrangler.toml` bằng extension ID và model đã được DUC duyệt.
2. Đặt secret, tuyệt đối không ghi key/token vào file source:

```bash
pnpm --filter @flr/api exec wrangler secret put TEAM_TOKEN --env production
pnpm --filter @flr/api exec wrangler secret put ANTHROPIC_API_KEY --env production
```

3. Deploy sau khi P4 được duyệt:

```bash
pnpm --filter @flr/api deploy
```

`AnthropicProvider` có timeout 15 giây. Provider lỗi hoặc trả JSON sai schema sẽ được retry đúng một lần; nếu vẫn lỗi, API trả `502 ai_unavailable`. Log chỉ có timestamp, route, method, status, latency và số byte đầu vào — không có body, token hoặc key.
