import { beforeAll } from "vitest";

/**
 * TEST-PLAN.md §2 — quy tắc vàng: unit test KHÔNG BAO GIỜ gọi mạng
 * (và không bao giờ chạm facebook.com thật). Test nào cần HTTP phải
 * mock fetch một cách tường minh trong chính test đó.
 */
beforeAll(() => {
  const blocked: typeof fetch = () => {
    throw new Error(
      "Network bị chặn trong unit test (docs/TEST-PLAN.md §2). Hãy mock fetch tường minh.",
    );
  };
  globalThis.fetch = blocked;
});
