import {
  CounterStateSchema,
  DEFAULT_SETTINGS,
  DEFAULT_TIME_ZONE,
  SettingsSchema,
  STORAGE_KEYS,
  SystemStateSchema,
  type CounterState,
  type Settings,
  type SystemState,
} from "@flr/shared";

export interface KeyValueStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  setMany(values: Readonly<Record<string, unknown>>): Promise<void>;
}

export const chromeLocalStorage: KeyValueStorage = {
  async get(key) {
    const values = await chrome.storage.local.get(key);
    return values[key];
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
  async setMany(values) {
    await chrome.storage.local.set(values);
  },
};

export const DEFAULT_SYSTEM_STATE: SystemState = SystemStateSchema.parse({});

export const dateInProjectTimeZone = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const createDefaultCounters = (now: Date): CounterState =>
  CounterStateSchema.parse({ date: dateInProjectTimeZone(now) });

export const readSettings = async (
  storage: KeyValueStorage,
): Promise<Settings> => {
  const stored = await storage.get(STORAGE_KEYS.settings);
  if (stored === undefined) return DEFAULT_SETTINGS;
  const parsed = SettingsSchema.safeParse(stored);
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS, allowlist: [] };
};

export const writeSettings = async (
  storage: KeyValueStorage,
  settings: unknown,
): Promise<Settings> => {
  const parsed = SettingsSchema.parse(settings);
  await storage.set(STORAGE_KEYS.settings, parsed);
  return parsed;
};

export const readSystemState = async (
  storage: KeyValueStorage,
): Promise<SystemState> => {
  const stored = await storage.get(STORAGE_KEYS.state);
  if (stored === undefined) return DEFAULT_SYSTEM_STATE;
  const parsed = SystemStateSchema.safeParse(stored);
  return parsed.success
    ? parsed.data
    : { ...DEFAULT_SYSTEM_STATE, emergencyStop: true };
};

export const writeSystemState = async (
  storage: KeyValueStorage,
  state: unknown,
): Promise<SystemState> => {
  const parsed = SystemStateSchema.parse(state);
  await storage.set(STORAGE_KEYS.state, parsed);
  return parsed;
};

export const readCounters = async (
  storage: KeyValueStorage,
  now: Date,
): Promise<CounterState> => {
  const currentDate = dateInProjectTimeZone(now);
  const stored = await storage.get(STORAGE_KEYS.counters);
  const parsed = CounterStateSchema.safeParse(stored);
  if (!parsed.success || parsed.data.date !== currentDate) {
    return createDefaultCounters(now);
  }
  return parsed.data;
};

export const writeCounters = async (
  storage: KeyValueStorage,
  counters: unknown,
): Promise<CounterState> => {
  const parsed = CounterStateSchema.parse(counters);
  await storage.set(STORAGE_KEYS.counters, parsed);
  return parsed;
};

export const ensureStorageDefaults = async (
  storage: KeyValueStorage,
  now: Date,
): Promise<void> => {
  const settings = await storage.get(STORAGE_KEYS.settings);
  if (settings === undefined) await writeSettings(storage, DEFAULT_SETTINGS);

  const state = await storage.get(STORAGE_KEYS.state);
  if (state === undefined)
    await writeSystemState(storage, DEFAULT_SYSTEM_STATE);

  const counters = await storage.get(STORAGE_KEYS.counters);
  if (counters === undefined) {
    await storage.set(STORAGE_KEYS.counters, createDefaultCounters(now));
  }
};
