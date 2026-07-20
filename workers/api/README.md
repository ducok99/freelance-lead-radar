# @flr/api — Cloudflare Workers backend

Phase 0: mới có khung package. Hono + `/v1/classify` + `/v1/draft` sẽ vào ở Phase 4 (docs/IMPLEMENTATION-PLAN.md).

Quy tắc secret (SECURITY.md §6): key AI và TEAM_TOKEN chỉ tồn tại trong `wrangler secret` (production) hoặc `.dev.vars` local (gitignored, mẫu ở `.dev.vars.example`). Không bao giờ nằm trong source, wrangler.toml hay extension.
