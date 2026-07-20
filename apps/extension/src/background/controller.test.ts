import { DEFAULT_SETTINGS, STORAGE_KEYS } from "@flr/shared";
import { describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../test/memory-storage";
import { handleBackgroundMessage } from "./controller";

const createPorts = (storage: MemoryStorage) => ({
  storage,
  now: () => new Date("2026-07-20T08:00:00.000Z"),
  broadcast: vi.fn(() => Promise.resolve()),
});

describe("background controller P5", () => {
  it("gate chỉ allow nhóm active trong allowlist", async () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEYS.settings, {
      ...DEFAULT_SETTINGS,
      allowlist: [
        {
          groupId: "allowed.group",
          name: "Allowed",
          url: "https://www.facebook.com/groups/allowed.group",
          active: true,
        },
      ],
    });

    const ports = createPorts(storage);
    await expect(
      handleBackgroundMessage(
        { type: "GET_GATE_STATE" },
        "https://www.facebook.com/groups/not-allowed",
        ports,
      ),
    ).resolves.toMatchObject({ type: "GATE_STATE", allowlisted: false });
    await expect(
      handleBackgroundMessage(
        { type: "GET_GATE_STATE" },
        "https://www.facebook.com/groups/allowed.group/posts/1",
        ports,
      ),
    ).resolves.toMatchObject({ type: "GATE_STATE", allowlisted: true });
  });

  it("bật Emergency Stop persist trước khi broadcast", async () => {
    const storage = new MemoryStorage();
    const ports = createPorts(storage);
    await handleBackgroundMessage(
      { type: "SET_EMERGENCY_STOP", enabled: true },
      undefined,
      ports,
    );

    expect(storage.values.get(STORAGE_KEYS.state)).toMatchObject({
      emergencyStop: true,
    });
    expect(ports.broadcast).toHaveBeenCalledWith({
      type: "EMERGENCY_STOP_CHANGED",
      enabled: true,
    });
  });

  it("warning trip circuit breaker và Emergency Stop", async () => {
    const storage = new MemoryStorage();
    const ports = createPorts(storage);
    await handleBackgroundMessage(
      {
        type: "WARNING_DETECTED",
        reason: "captcha_detected",
        detectedAt: "2026-07-20T08:00:00.000Z",
      },
      undefined,
      ports,
    );
    expect(storage.values.get(STORAGE_KEYS.state)).toMatchObject({
      emergencyStop: true,
      circuitBreaker: { state: "tripped", reason: "captcha_detected" },
    });
  });

  it("message không hợp lệ bị bỏ qua, P5 chưa xử lý POST_SEEN", async () => {
    const storage = new MemoryStorage();
    const ports = createPorts(storage);
    await expect(
      handleBackgroundMessage({ type: "HACK" }, undefined, ports),
    ).resolves.toBeUndefined();
  });
});
