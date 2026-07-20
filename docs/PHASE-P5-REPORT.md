# PHASE P5.1 REPORT — Chrome Extension MV3 shell

Ngày: 2026-07-20  
Trạng thái: **Hoàn thành; GitHub Actions xanh commit `d6230ed`; DUC chính thức duyệt P5 ngày 2026-07-20.**

## Sửa lỗi P5.1

Smoke test ban đầu phát hiện nút Emergency Stop không đổi trạng thái. Nguyên
nhân là hai entry đều mang tên `index.ts`, khiến bản build CRXJS có thể nạp
content script vào `service-worker-loader.js`. P5.1 đổi tên entry thành
`service-worker.ts` và `content-script.ts`, đồng thời thêm
`scripts/verify-build.mjs` để build fail nếu background chunk bị hoán đổi hoặc
thiếu listener/storage guard. Popup và trang cài đặt cũng có trạng thái đang xử
lý cùng thông báo lỗi/thành công rõ ràng.

## Kết quả đã triển khai

- Manifest V3 với đúng `storage`, `sidePanel` và host
  `https://www.facebook.com/*`; Chrome tối thiểu 116.
- Background service worker lưu settings/state/counters bằng `chrome.storage.local`
  và giới hạn storage cho trusted extension contexts.
- Gate content script hỏi background trước khi tạo observer; ngoài allowlist,
  Emergency Stop, circuit breaker hoặc background lỗi đều ngủ fail-safe.
- P5 cố tình không xử lý `POST_SEEN`, lead, API hoặc comment.
- Popup hiển thị trạng thái, allowlist, counters, nút Emergency Stop, mở side panel
  và trang cài đặt.
- Side panel là hàng đợi rỗng; options có CRUD allowlist, kỹ năng team, thành viên,
  API/token dạng password và giới hạn an toàn.
- Playwright E2E dùng Chromium thật và fixture HTML local để kiểm tra nhóm ngoài
  allowlist không ghi lead/dedupe/audit, extraction counters vẫn bằng 0.

## QA tại Codex

| Gate                                 | Kết quả                                       |
| ------------------------------------ | --------------------------------------------- |
| `pnpm typecheck`                     | Đạt, 6/6 workspace                            |
| `pnpm test`                          | Đạt, 34 file / 381 test                       |
| `pnpm test:coverage`                 | Đạt; toàn repo 95,75% line                    |
| Extension controller                 | 86,41% line                                   |
| Extension content gate               | 89,58% line                                   |
| Extension pure libs                  | 85,49% line                                   |
| `pnpm --filter @flr/extension build` | Đạt, sinh `dist/manifest.json` và ba UI shell |
| Manifest build inspection            | Đạt, đúng 2 permission và 1 Facebook host     |
| Verifier service worker P5.1         | Đạt, background/content dùng đúng entry       |
| Smoke Chrome Windows                 | Đạt: allowlist, side panel, Stop, persistence |

`pnpm install --frozen-lockfile`, `pnpm check-secrets`, `pnpm check-api-safety`
và `pnpm lint` cũng đã đạt trong vòng QA cuối.

## Bằng chứng nghiệm thu

1. Playwright đã nhận đúng 1 E2E test; GitHub Actions đã cài Chromium và chạy
   xanh trên commit `d6230ed`.
2. DUC đã load unpacked P5.1 trên Chrome Windows và xác nhận allowlist, side
   panel, Emergency Stop và trạng thái persist qua mở lại đều đạt.
3. DUC đã xác nhận chính thức duyệt P5 và cho phép bắt đầu P6.

## Danh sách file thay đổi

- Toolchain/CI: `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`,
  `.github/workflows/ci.yml`, `.gitignore`.
- Extension config: `apps/extension/package.json`, `tsconfig.json`,
  `manifest.config.ts`, `vite.config.ts`, `playwright.config.ts`.
- Runtime: `src/background/{controller,service-worker}.ts`,
  `src/content/{gate,content-script}.ts`,
  `src/lib/{group-url,storage,ulid}.ts`, `src/index.ts`.
- UI: `src/popup/*`, `src/sidepanel/*`, `src/options/*`, `src/ui/styles.css`.
- Test: manifest, controller, gate, storage, group URL, ULID,
  `src/test/memory-storage.ts`, `e2e/outside-allowlist.spec.ts`; xóa test placeholder
  cũ `apps/extension/src/index.test.ts`.
- Build guard: thêm `apps/extension/scripts/verify-build.mjs`.
- Tài liệu: `README.md`, `CLAUDE.md`, `docs/IMPLEMENTATION-PLAN.md`,
  `docs/TEST-PLAN.md`, `docs/PHASE-P4-REPORT.md`, thêm
  `docs/PHASE-P5-REPORT.md` và `apps/extension/README.md`.

## Rủi ro còn lại / cố tình chưa làm

- P5 không có pipeline đọc bài; side panel rỗng là hành vi đúng của riêng P5.
- Sau khi tắt Emergency Stop, tab Facebook đã ngủ cần reload ở P5. Cơ chế resume
  pipeline được triển khai ở P6.
- Không có auto reply, submit, click Đăng, DM, proxy Facebook hoặc server bot.
