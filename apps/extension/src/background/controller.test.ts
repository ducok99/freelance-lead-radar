import { DEFAULT_SETTINGS, STORAGE_KEYS } from "@flr/shared";
import { describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../test/memory-storage";
import { handleBackgroundMessage } from "./controller";

const createPorts = (storage: MemoryStorage) => ({
  storage,
  now: () => new Date("2026-07-20T08:00:00.000Z"),
  broadcast: vi.fn(() => Promise.resolve()),
  pipeline: {
    enqueue: vi.fn(() => Promise.resolve()),
    recordExtractionFailure: vi.fn(() => Promise.resolve()),
    recordSystemAudit: vi.fn(() => Promise.resolve()),
    listLeads: vi.fn(() => Promise.resolve([])),
    reviewLead: vi.fn(() => Promise.resolve({ ok: true, leads: [] })),
    editDraft: vi.fn(() => Promise.resolve({ ok: true, leads: [] })),
    retryLead: vi.fn(() => Promise.resolve({ ok: true, leads: [] })),
  },
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
    expect(ports.pipeline.recordSystemAudit).toHaveBeenCalledWith(
      "emergency_stop_on",
    );
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

  it("POST_SEEN chỉ vào pipeline khi sender và post cùng nhóm allowlist", async () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEYS.settings, {
      ...DEFAULT_SETTINGS,
      allowlist: [
        {
          groupId: "allowed",
          name: "Allowed",
          url: "https://www.facebook.com/groups/allowed",
          active: true,
        },
      ],
    });
    const ports = createPorts(storage);
    const message = {
      type: "POST_SEEN" as const,
      post: {
        postKey: "allowed:101",
        groupId: "allowed",
        permalink: "https://www.facebook.com/groups/allowed/posts/101/",
        text: "Cần thuê freelancer thiết kế logo.",
        anonymousPoster: false,
        truncated: false,
        seenAt: "2026-07-20T08:00:00.000Z",
      },
    };

    await handleBackgroundMessage(
      message,
      "https://www.facebook.com/groups/allowed",
      ports,
    );
    expect(ports.pipeline.enqueue).toHaveBeenCalledWith(message.post);

    await handleBackgroundMessage(
      message,
      "https://www.facebook.com/groups/other",
      ports,
    );
    expect(ports.pipeline.enqueue).toHaveBeenCalledTimes(1);
  });

  it("UI lấy danh sách và action qua pipeline typed", async () => {
    const storage = new MemoryStorage();
    const ports = createPorts(storage);
    await expect(
      handleBackgroundMessage({ type: "GET_LEADS" }, undefined, ports),
    ).resolves.toEqual({ type: "LEADS_UPDATED", leads: [] });

    await expect(
      handleBackgroundMessage(
        {
          type: "REVIEW_LEAD",
          leadId: "01J2ZK8Q9M3T5V7X9A1C3E5G7J",
          action: "approve",
        },
        undefined,
        ports,
      ),
    ).resolves.toEqual({ type: "LEADS_UPDATED", leads: [] });
  });

  it("message không hợp lệ bị bỏ qua", async () => {
    const storage = new MemoryStorage();
    const ports = createPorts(storage);
    await expect(
      handleBackgroundMessage({ type: "HACK" }, undefined, ports),
    ).resolves.toBeUndefined();
  });
});
