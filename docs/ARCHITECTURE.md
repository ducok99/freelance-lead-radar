# ARCHITECTURE — FREELANCE LEAD RADAR

v0.1 — 2026-07-18 — đã được DUC duyệt. Đọc kèm: PRD.md, DATA-MODEL.md, SECURITY.md.

## 1. Năm nguyên tắc kiến trúc

1. **Logic quyết định là code thuần, test được không cần trình duyệt.** Mọi hard filter, tổng hợp điểm, đếm giới hạn, circuit breaker nằm trong `packages/rules-engine` (pure TypeScript, không DOM, không network).
2. **Mọi va chạm với DOM Facebook cô lập trong một package duy nhất** (`packages/facebook-adapter`). Facebook đổi giao diện → chỉ sửa một chỗ, có fixture regression bảo vệ.
3. **AI chỉ chạy ở backend** (Cloudflare Workers). API key nằm trong Workers secret, không bao giờ xuất hiện trong extension, source code hay repo.
4. **Fail-safe: mặc định không hành động.** Thiếu dữ liệu, lỗi parse, mất mạng, cảnh báo Facebook, Emergency Stop → pipeline dừng ở trạng thái an toàn, không bao giờ "cứ thử đăng".
5. **Human-in-the-loop.** Trong MVP, không tồn tại code path nào đăng bình luận mà không có thao tác duyệt của người dùng.

## 2. Sơ đồ tổng thể

```
┌────────────────────────── Chrome (máy người dùng, đã đăng nhập FB) ─────────────────────────┐
│                                                                                             │
│  facebook.com (tab người dùng tự mở)                                                        │
│  ┌───────────────────────────────┐                                                          │
│  │ Content Script (mỏng)         │  MutationObserver + IntersectionObserver                 │
│  │  - gate: allowlist? stop?     │  chỉ đọc bài ĐANG HIỂN THỊ                               │
│  │  - facebook-adapter: extract  │────────────┐                                             │
│  │  - facebook-adapter: điền     │            │ chrome.runtime message (typed)              │
│  │    ô bình luận khi được duyệt │            ▼                                             │
│  └───────────────────────────────┘   ┌─────────────────────────────┐                        │
│                                      │ Background Service Worker    │                        │
│  ┌───────────────┐  ┌────────────┐   │  - dedupe (postKey)          │                        │
│  │ Popup          │  │ Side Panel │   │  - rules-engine: filter/score│                        │
│  │  Emergency     │  │ Hàng đợi   │◄──┤  - batch gọi Workers API     │                        │
│  │  Stop, counter │  │ duyệt lead │   │  - LeadStore (storage.local) │                        │
│  └───────────────┘  └────────────┘   │  - counters, circuit breaker │                        │
│  ┌──────────────────────────────┐    └──────────────┬──────────────┘                        │
│  │ Options + Dashboard page     │                   │ HTTPS + Bearer TEAM_TOKEN             │
│  │ (trang mở rộng của extension)│                   │ (không cookie FB, không PII thừa)     │
│  └──────────────────────────────┘                   ▼                                       │
└─────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                          │
                        ┌─────────────────▼──────────────────┐
                        │ workers/api (Cloudflare Workers)    │
                        │  Hono: auth, rate limit, zod        │
                        │  AIProvider ──► Anthropic API       │
                        │  (secret trong wrangler secret)     │
                        │  Giai đoạn 2: D1 (leads, audit)     │
                        └─────────────────────────────────────┘
```

Điểm cần chú ý: extension **không bao giờ** gửi cookie/session Facebook lên Worker; Worker **không bao giờ** gọi vào Facebook. Backend chỉ nhận văn bản bài viết đã qua lọc để phân loại.

## 3. Cấu trúc monorepo

```
freelance-lead-radar/
├── CLAUDE.md                    # Quy tắc làm việc cho phiên code (bắt buộc đọc)
├── README.md                    # Chỉ mục + trạng thái dự án
├── package.json                 # scripts gốc: typecheck, lint, test, build
├── pnpm-workspace.yaml
├── turbo.json                   # Điều phối task theo package
├── tsconfig.base.json           # TS strict chung
├── eslint.config.mjs            # Flat config + rule an toàn (cấm document.cookie…)
├── .github/workflows/ci.yml    # typecheck → lint → unit test → build
├── docs/                        # PRD, ARCHITECTURE, DATA-MODEL, SECURITY,
│                                # IMPLEMENTATION-PLAN, TEST-PLAN
├── apps/
│   ├── extension/               # Chrome Extension MV3 + React (Vite + CRXJS)
│   │   ├── manifest.config.ts   # Quyền tối thiểu (xem SECURITY.md §4)
│   │   └── src/
│   │       ├── background/      # SW: pipeline, LeadStore, counters, API client
│   │       ├── content/         # Script mỏng: observe → gate → adapter
│   │       ├── sidepanel/       # React: hàng đợi duyệt lead
│   │       ├── popup/           # React: trạng thái + Emergency Stop
│   │       ├── pages/dashboard/ # React: pipeline, phân công, nhãn, audit (MVP)
│   │       ├── pages/options/   # React: allowlist, team, token, giới hạn
│   │       └── lib/             # messaging typed, LeadStore impl, logger
│   └── dashboard/               # Web app cho team — GIAI ĐOẠN 2 (chỉ giữ chỗ trong MVP)
├── workers/
│   └── api/                     # Cloudflare Workers (Hono)
│       ├── src/
│       │   ├── index.ts         # routes: /v1/health, /v1/classify, /v1/draft
│       │   ├── middleware/      # auth bearer, rate limit, zod validate, CORS
│       │   ├── providers/       # AIProvider interface + AnthropicProvider + MockProvider
│       │   └── prompts/         # prompt phân loại + soạn nháp (tiếng Việt)
│       ├── wrangler.toml        # KHÔNG chứa secret; secret qua `wrangler secret put`
│       └── migrations/          # SQL cho D1 — giai đoạn 2
├── packages/
│   ├── shared/                  # zod schemas + types + hằng số (nguồn chân lý duy nhất)
│   ├── rules-engine/            # hard filters, lexicon VN, gate, tổng hợp điểm,
│   │                            # counters, circuit breaker — PURE, phủ test dày nhất
│   └── facebook-adapter/        # selector, extract Post, parse postKey, comment box
└── fixtures/
    └── facebook/                # HTML giả lập đã làm sạch PII (xem TEST-PLAN §3)
```

## 4. Chi tiết từng thành phần

### 4.1 apps/extension (Manifest V3)

Quyền yêu cầu (tối thiểu tuyệt đối — mỗi quyền có giải trình trong SECURITY.md §4):

```jsonc
{
  "permissions": ["storage", "sidePanel"],
  "host_permissions": [
    "https://www.facebook.com/*",
    "https://*.workers.dev/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
  ],
}
```

Không dùng: `tabs`, `cookies`, `webRequest`, `scripting`, `history`, `<all_urls>`.

- **Content script** (chạy ở `document_idle` trên facebook.com): tầng mỏng nhất có thể. Ở P6: (1) hỏi background "nhóm này có trong allowlist không, hệ thống có đang dừng không"; nếu không đạt → ngủ hoàn toàn, không gắn observer; (2) nếu đạt → gắn observer, gọi adapter extract bài hiển thị, gửi Post thô về background; (3) nhận điểm để vẽ badge cô lập bằng Shadow DOM; (4) phát hiện tín hiệu cảnh báo Facebook → báo background kích circuit breaker. Không có fill/click/submit ở P6; thao tác điền chỉ được thêm ở P7 sau khi duyệt.
- **Background service worker**: bộ não. Nhận Post → dedupe → hard filter giai đoạn 1 → batch gọi Worker → hard filter giai đoạn 2 + tổng hợp điểm → ghi LeadStore atomically → đẩy side panel. Giữ counters ngày, trạng thái Emergency Stop và circuit breaker. Lead `detected` chưa hoàn tất được tự tiếp tục khi SW MV3 khởi động lại; retry luôn kiểm tra lại stop, allowlist và giới hạn ngày.
- **Side panel**: hàng đợi duyệt. P6 hiển thị điểm + breakdown, phân loại, trích xuất, nháp (sửa trực tiếp), Duyệt lead (chỉ đổi trạng thái local), Bỏ qua và Retry. Không có nút Chèn/Đăng cho đến P7.
- **Popup**: trạng thái pipeline, counters hôm nay, nút **Emergency Stop** (toggle to, đỏ, 1 chạm).
- **Trang Dashboard (trong extension)**: bảng pipeline theo trạng thái, phân công thành viên, thống kê precision, audit log, export JSON/CSV.
- **Options**: allowlist nhóm (URL → chuẩn hóa groupId), hồ sơ team (thành viên + kỹ năng), TEAM_TOKEN, giới hạn ngày, retention.

### 4.2 workers/api (Hono trên Cloudflare Workers)

| Route               | Mô tả                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/health`    | Kiểm tra sống, không auth                                                                                                                             |
| `POST /v1/classify` | Nhận batch ≤ 10 bài `{posts: PostInput[]}` → `{results: ClassifyResult[]}` (phân loại, confidence, điểm thành phần, trích xuất). Zod validate 2 chiều |
| `POST /v1/draft`    | Nhận ngữ cảnh 1 lead + hồ sơ năng lực team → `{draft, rationale}`                                                                                     |
| Giai đoạn 2         | `/v1/leads`, `/v1/audit`, `/v1/team` (CRUD + sync với D1)                                                                                             |

- Middleware: `Authorization: Bearer <TEAM_TOKEN>` (so sánh constant-time với secret) → rate limit theo token (60 req/phút) → giới hạn kích thước payload 64KB → zod validate.
- CORS: chỉ cho phép origin `chrome-extension://<EXTENSION_ID>`.
- `AIProvider` interface: `classify(posts, ctx)` và `draftComment(lead, teamProfile)`. Hai implementation: `AnthropicProvider` (production) và `MockProvider` (toàn bộ test + wrangler dev không cần key). Model đề xuất: model nhỏ/nhanh cho classify, model lớn hơn cho draft (cấu hình bằng env var, xem A-03).
- Prompt trả về JSON theo schema, Worker validate bằng zod trước khi trả extension; JSON hỏng → retry 1 lần → lỗi có mã rõ ràng (extension hiển thị "phân tích thất bại", không đoán mò).
- Log: chỉ metadata (timestamp, route, mã lỗi, độ dài input). Không log nội dung bài viết, không log token.

### 4.3 packages/shared

Zod schema là **nguồn chân lý duy nhất**; type TypeScript infer từ zod (`z.infer`). Chứa: mọi entity (DATA-MODEL.md), message types giữa content ↔ background ↔ UI, request/response API, hằng số ngưỡng (75/94/95), giới hạn mặc định, `SCHEMA_VERSION`.

### 4.4 packages/rules-engine

Pure function, không side effect. Module chính: `lexicon/` (bộ từ khóa tiếng Việt: tín hiệu thuê, tín hiệu tìm việc, tín hiệu full-time, tín hiệu spam/scam, tín hiệu "làm thử miễn phí", "không thuê ngoài"), `gate.ts` (có đáng gửi AI không), `hardFilters.ts` (9 lý do loại — enum trong DATA-MODEL.md §5, chạy 2 giai đoạn: trước AI với luật rẻ, sau AI với luật cần phân loại), `scoring.ts` (tổng hợp điểm từ thành phần AI + điều chỉnh + trần confidence), `counters.ts` (giới hạn ngày), `circuitBreaker.ts` (máy trạng thái: `armed → tripped → cần người dùng reset tay`).

### 4.5 packages/facebook-adapter

- **Chiến lược selector**: dựa `role`/`aria-*`/cấu trúc ngữ nghĩa (`role="feed"`, `role="article"`) và heuristic văn bản; **cấm tuyệt đối class name obfuscated** của Facebook. Mọi selector khai báo tập trung một file để dễ vá.
- `extractPost(el): RawPost | ExtractionFailure` — không bao giờ throw; layout lạ → trả failure có mã, background đếm vào extractionFailureRate.
- `parsePostKey(url)`: hỗ trợ các dạng `/groups/{gid}/posts/{pid}`, `/groups/{gid}/permalink/{pid}`, `story.php?story_fbid=…&id=…`, dạng `pfbid…` → chuẩn hóa `groupId:postId`.
- `fillCommentBox(el, text)`: tìm ô bình luận của đúng bài đang mở, điền text, đưa focus. **Package này không export bất kỳ hàm submit/click-đăng nào trong MVP** (bất biến, có test tĩnh bảo vệ — SECURITY.md §3).
- `detectWarningSignals(document)`: nhận diện checkpoint URL, hộp CAPTCHA, banner "tạm thời bị chặn"/"You're temporarily blocked".

### 4.6 Dashboard: MVP vs Giai đoạn 2

MVP dùng **trang dashboard bên trong extension** (đọc thẳng chrome.storage.local — nhanh, không cần auth). `apps/dashboard` là web app riêng cho cả team ở giai đoạn 2, nói chuyện với Workers API + D1, tái sử dụng schema từ `packages/shared`. Chấp nhận một phần UI trùng lặp giữa hai nơi để đổi lấy ranh giới đơn giản (ADR-09).

### 4.7 Storage abstraction

Interface `LeadStore` (get/put/list/label/purge…) với implementation MVP `ChromeStorageLeadStore`. Giai đoạn 2 thêm `ApiLeadStore` (D1 qua Workers) — UI không đổi. Layout key và chính sách quota: DATA-MODEL.md §6.

## 5. Messaging và trạng thái

- Mọi message giữa content ↔ background ↔ UI là typed union (zod) trong `shared`: `POST_SEEN`, `INSERT_COMMENT`, `WARNING_DETECTED`, `EMERGENCY_STOP_CHANGED`, `LEADS_UPDATED`…
- Emergency Stop và circuit breaker được kiểm tra ở **3 lớp**: content script (không extract), background (không gọi API), adapter (không điền comment). Một lớp fail vẫn còn hai lớp chặn.
- Vòng đời trạng thái Lead: xem máy trạng thái trong DATA-MODEL.md §4 — mọi transition đều qua một hàm `transition(lead, event)` trong rules-engine để test được.

## 6. Công nghệ và phiên bản đề xuất

| Hạng mục        | Chọn                                             | Lý do                                                |
| --------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Package manager | pnpm 10 + workspaces                             | Chuẩn monorepo, nhanh                                |
| Điều phối task  | Turborepo                                        | `pnpm typecheck/lint/test` một lệnh toàn repo, cache |
| Ngôn ngữ        | TypeScript strict (không `any`)                  | An toàn, dễ bảo trì                                  |
| Extension build | Vite + @crxjs/vite-plugin                        | HMR cho MV3, React                                   |
| UI              | React 18                                         | Theo spec                                            |
| Backend         | Hono trên Cloudflare Workers                     | Nhẹ, typed, chạy tốt trên Workers                    |
| Validate        | zod                                              | Schema dùng chung client/server                      |
| Unit test       | Vitest (+ happy-dom cho adapter)                 | Theo spec                                            |
| Integration     | Playwright (Chromium + extension, fixture local) | Theo spec                                            |
| DB production   | Cloudflare D1 (giai đoạn 2)                      | Theo spec                                            |
| Lint/format     | ESLint flat config + Prettier                    | Kèm rule an toàn tùy chỉnh                           |

## 7. Quyết định kiến trúc (ADR tóm tắt)

| ID     | Quyết định                                                                                                       | Lý do chính                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ADR-01 | Đọc thụ động tuyệt đối: không tự điều hướng, không tự refresh, không tab nền, không tự bấm "Xem thêm" (mặc định) | Đúng spec "chỉ đọc nội dung đang hiển thị"; giảm mạnh rủi ro ToS            |
| ADR-02 | MVP: điền sẵn ô bình luận, người dùng tự bấm Đăng                                                                | Hành vi đăng cuối cùng luôn là của con người; DUC đã chốt 2026-07-18 (A-02) |
| ADR-03 | AI chấm điểm thành phần; rules-engine tổng hợp điểm cuối deterministic                                           | Test được, giải thích được, chống AI "tự tiện" cho điểm                     |
| ADR-04 | chrome.storage.local trước, D1 sau, qua interface LeadStore                                                      | Đúng spec MVP; chuyển đổi không đập UI                                      |
| ADR-05 | Selector theo role/aria/heuristic, cấm class obfuscated; cô lập trong facebook-adapter                           | Facebook đổi class liên tục                                                 |
| ADR-06 | Phân phối nội bộ unpacked, không CWS trong MVP                                                                   | Rủi ro chính sách CWS (A-10)                                                |
| ADR-07 | `AIProvider` interface + MockProvider                                                                            | Test không cần key; đổi provider rẻ                                         |
| ADR-08 | Zod là nguồn chân lý schema                                                                                      | Một định nghĩa, validate cả hai đầu                                         |
| ADR-09 | Dashboard MVP nằm trong extension; apps/dashboard để giai đoạn 2                                                 | Tránh dựng auth + hosting sớm; dữ liệu MVP vốn nằm local                    |
| ADR-10 | Hai giai đoạn hard filter (trước AI: luật rẻ; sau AI: luật cần phân loại)                                        | Tiết kiệm chi phí AI, vẫn đúng ngữ nghĩa 9 filter                           |

## 8. Những gì kiến trúc này CỐ TÌNH không có

Để đối chiếu nhanh với QUY TẮC AN TOÀN TUYỆT ĐỐI (chi tiết + cách thực thi: SECURITY.md §3): không server-side Facebook bot, không lưu credential/cookie/session FB ở bất kỳ đâu ngoài trình duyệt của chính người dùng, không proxy rotation, không fingerprint spoofing, không vượt CAPTCHA, không cơ chế "né phát hiện", không auto DM, không hàng đợi đăng hàng loạt, không code path tự đăng trong MVP.
