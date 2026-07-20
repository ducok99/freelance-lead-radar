import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  FixedWindowRateLimiter,
  hashToken,
} from "./security";

describe("constant-time token helpers", () => {
  it("so sánh đúng token", async () => {
    await expect(constantTimeEqual("same-token", "same-token")).resolves.toBe(
      true,
    );
  });

  it.each(["wrong-token", "short", ""])("từ chối token %j", async (token) => {
    await expect(constantTimeEqual(token, "expected-token")).resolves.toBe(
      false,
    );
  });

  it("hash token ổn định và không giữ token thô", async () => {
    const first = await hashToken("sensitive-token");
    const second = await hashToken("sensitive-token");
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toContain("sensitive-token");
  });
});

describe("FixedWindowRateLimiter", () => {
  it("chặn sau giới hạn và reset ở cửa sổ mới", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    expect(limiter.consume("hash", 0)).toBe(true);
    expect(limiter.consume("hash", 1)).toBe(true);
    expect(limiter.consume("hash", 2)).toBe(false);
    expect(limiter.consume("hash", 1_000)).toBe(true);
  });

  it("đếm độc lập theo hash token", () => {
    const limiter = new FixedWindowRateLimiter(1);
    expect(limiter.consume("a", 0)).toBe(true);
    expect(limiter.consume("a", 0)).toBe(false);
    expect(limiter.consume("b", 0)).toBe(true);
  });
});
