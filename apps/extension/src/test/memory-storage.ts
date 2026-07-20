import type { KeyValueStorage } from "../lib/storage";

export class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.values.get(key));
  }

  set(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
    return Promise.resolve();
  }

  setMany(values: Readonly<Record<string, unknown>>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      this.values.set(key, structuredClone(value));
    }
    return Promise.resolve();
  }
}
