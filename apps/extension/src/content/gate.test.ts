import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SYSTEM_STATE } from "../lib/storage";
import {
  startContentGate,
  type ContentRuntime,
  type ObserverPort,
} from "./gate";

const createRuntime = (response: unknown) => {
  const observer: ObserverPort = {
    observe: vi.fn(),
    disconnect: vi.fn(),
  };
  let listener: ((message: unknown) => void) | undefined;
  const runtime: ContentRuntime = {
    body: {} as Node,
    sendMessage: vi.fn(() => Promise.resolve(response)),
    createObserver: vi.fn(() => observer),
    addMessageListener: vi.fn((next) => {
      listener = next;
      return vi.fn();
    }),
  };
  return { runtime, observer, emit: (message: unknown) => listener?.(message) };
};

describe("content gate P5", () => {
  it("nhóm ngoài allowlist không gắn observer và không gửi POST_SEEN", async () => {
    const { runtime } = createRuntime({
      type: "GATE_STATE",
      allowlisted: false,
      systemState: DEFAULT_SYSTEM_STATE,
    });
    const result = await startContentGate(runtime);
    expect(result).toMatchObject({ active: false, reason: "not_allowlisted" });
    expect(runtime.createObserver).not.toHaveBeenCalled();
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type: "GET_GATE_STATE",
    });
  });

  it("Emergency Stop bật thì không gắn observer", async () => {
    const { runtime } = createRuntime({
      type: "GATE_STATE",
      allowlisted: true,
      systemState: { ...DEFAULT_SYSTEM_STATE, emergencyStop: true },
    });
    await expect(startContentGate(runtime)).resolves.toMatchObject({
      active: false,
      reason: "stopped",
    });
    expect(runtime.createObserver).not.toHaveBeenCalled();
  });

  it("nhóm allowlist mới gắn observer và stop ngay khi nhận Emergency Stop", async () => {
    const { runtime, observer, emit } = createRuntime({
      type: "GATE_STATE",
      allowlisted: true,
      systemState: DEFAULT_SYSTEM_STATE,
    });
    await expect(startContentGate(runtime)).resolves.toMatchObject({
      active: true,
      reason: "active",
    });
    expect(observer.observe).toHaveBeenCalledOnce();
    emit({ type: "EMERGENCY_STOP_CHANGED", enabled: true });
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("background unavailable thì ngủ fail-safe", async () => {
    const { runtime } = createRuntime(undefined);
    await expect(startContentGate(runtime)).resolves.toMatchObject({
      active: false,
      reason: "unavailable",
    });
    expect(runtime.createObserver).not.toHaveBeenCalled();
  });
});
