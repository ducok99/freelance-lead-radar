import { DEFAULT_SETTINGS, STORAGE_KEYS, SystemStateSchema } from "@flr/shared";
import { describe, expect, it } from "vitest";
import {
  createDefaultCounters,
  ensureStorageDefaults,
  readSettings,
  readSystemState,
  writeSystemState,
  type KeyValueStorage,
} from "./storage";
import { MemoryStorage } from "../test/memory-storage";

describe("extension storage", () => {
  it("khởi tạo settings, state và counters bền vững", async () => {
    const storage = new MemoryStorage();
    const now = new Date("2026-07-20T08:00:00.000Z");
    await ensureStorageDefaults(storage, now);

    expect(await readSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(SystemStateSchema.parse(await readSystemState(storage))).toEqual({
      emergencyStop: false,
      circuitBreaker: { state: "armed" },
      schemaVersion: 1,
    });
    expect(storage.values.get(STORAGE_KEYS.counters)).toEqual(
      createDefaultCounters(now),
    );
  });

  it("state hỏng fail-safe sang Emergency Stop", async () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEYS.state, { emergencyStop: "no" });
    expect((await readSystemState(storage)).emergencyStop).toBe(true);
  });

  it("Emergency Stop còn nguyên sau khi tạo controller/repository mới", async () => {
    const storage = new MemoryStorage();
    await writeSystemState(storage, {
      emergencyStop: true,
      circuitBreaker: { state: "armed" },
    });

    const restartedStorage: KeyValueStorage = {
      get: (key) => storage.get(key),
      set: (key, value) => storage.set(key, value),
      setMany: (values) => storage.setMany(values),
    };
    expect((await readSystemState(restartedStorage)).emergencyStop).toBe(true);
  });
});
