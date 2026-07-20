import { SystemStateSchema } from "@flr/shared";
import { describe, expect, it } from "vitest";
import {
  getPipelineStopReasons,
  isPipelineStopped,
  resetCircuitBreaker,
  setEmergencyStop,
  tripCircuitBreaker,
} from "./index";

const now = "2026-07-20T12:00:00+07:00";

describe("circuit breaker fail-safe", () => {
  it("armed không chặn", () => {
    expect(isPipelineStopped(SystemStateSchema.parse({}))).toBe(false);
  });
  it("trip khi thấy CAPTCHA", () => {
    expect(
      tripCircuitBreaker({ state: "armed" }, "captcha_detected", now),
    ).toEqual({ state: "tripped", reason: "captcha_detected", trippedAt: now });
  });
  it("từ chối timestamp trip không hợp lệ", () => {
    expect(() =>
      tripCircuitBreaker({ state: "armed" }, "captcha_detected", "sai"),
    ).toThrow();
  });
  it("trip idempotent giữ cảnh báo đầu tiên", () => {
    const first = {
      state: "tripped",
      reason: "checkpoint_detected",
      trippedAt: now,
    } as const;
    expect(
      tripCircuitBreaker(
        first,
        "captcha_detected",
        "2026-07-20T12:01:00+07:00",
      ),
    ).toBe(first);
  });
  it("không reset nếu chưa xác nhận tay", () => {
    expect(() =>
      resetCircuitBreaker(
        { state: "tripped", reason: "captcha_detected", trippedAt: now },
        false,
      ),
    ).toThrow();
  });
  it("reset sau xác nhận tay", () => {
    expect(
      resetCircuitBreaker(
        { state: "tripped", reason: "captcha_detected", trippedAt: now },
        true,
      ),
    ).toEqual({ state: "armed" });
  });
  it("Emergency Stop độc lập với circuit", () => {
    const stopped = setEmergencyStop(SystemStateSchema.parse({}), true);
    expect(getPipelineStopReasons(stopped)).toEqual(["emergency_stop"]);
  });
  it("hai lớp chặn cùng tồn tại", () => {
    const state = SystemStateSchema.parse({
      emergencyStop: true,
      circuitBreaker: {
        state: "tripped",
        reason: "facebook_warning",
        trippedAt: now,
      },
    });
    expect(getPipelineStopReasons(state)).toEqual([
      "emergency_stop",
      "circuit_breaker",
    ]);
  });
  it("tắt Emergency Stop không tự reset circuit", () => {
    const state = SystemStateSchema.parse({
      emergencyStop: true,
      circuitBreaker: {
        state: "tripped",
        reason: "facebook_warning",
        trippedAt: now,
      },
    });
    expect(setEmergencyStop(state, false).circuitBreaker.state).toBe("tripped");
  });
});
