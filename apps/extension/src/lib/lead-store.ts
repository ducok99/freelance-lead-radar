import {
  AuditEventSchema,
  AuditLogSchema,
  DedupeIndexSchema,
  LeadMapSchema,
  MAX_AUDIT_EVENTS,
  STORAGE_KEYS,
  type AuditEvent,
  type CounterState,
  type DedupeEntry,
  type Lead,
} from "@flr/shared";
import type { KeyValueStorage } from "./storage";

export interface LeadStoreCommit {
  lead?: Lead;
  dedupe?: { postKey: string; entry: DedupeEntry };
  audits?: readonly AuditEvent[];
  counters?: CounterState;
}

const readLeadMap = async (storage: KeyValueStorage) => {
  const parsed = LeadMapSchema.safeParse(await storage.get(STORAGE_KEYS.leads));
  return parsed.success ? parsed.data : {};
};

const readDedupeIndex = async (storage: KeyValueStorage) => {
  const parsed = DedupeIndexSchema.safeParse(
    await storage.get(STORAGE_KEYS.dedupe),
  );
  return parsed.success ? parsed.data : {};
};

const readAuditLog = async (storage: KeyValueStorage) => {
  const parsed = AuditLogSchema.safeParse(
    await storage.get(STORAGE_KEYS.audit),
  );
  return parsed.success ? parsed.data : [];
};

export class ChromeStorageLeadStore {
  #tail: Promise<void> = Promise.resolve();

  constructor(private readonly storage: KeyValueStorage) {}

  async list(): Promise<Lead[]> {
    const leads = await readLeadMap(this.storage);
    return Object.values(leads).sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );
  }

  async get(leadId: string): Promise<Lead | undefined> {
    return (await readLeadMap(this.storage))[leadId];
  }

  async findByPostKey(postKey: string): Promise<Lead | undefined> {
    const [leads, dedupe] = await Promise.all([
      readLeadMap(this.storage),
      readDedupeIndex(this.storage),
    ]);
    const leadId = dedupe[postKey]?.leadId;
    return leadId === undefined ? undefined : leads[leadId];
  }

  async hasPost(postKey: string): Promise<boolean> {
    return (await readDedupeIndex(this.storage))[postKey] !== undefined;
  }

  async audits(): Promise<AuditEvent[]> {
    return readAuditLog(this.storage);
  }

  commit(change: LeadStoreCommit): Promise<void> {
    return this.#exclusive(async () => {
      const writes: Record<string, unknown> = {};

      if (change.lead !== undefined) {
        const leads = await readLeadMap(this.storage);
        writes[STORAGE_KEYS.leads] = LeadMapSchema.parse({
          ...leads,
          [change.lead.id]: change.lead,
        });
      }

      if (change.dedupe !== undefined) {
        const dedupe = await readDedupeIndex(this.storage);
        writes[STORAGE_KEYS.dedupe] = DedupeIndexSchema.parse({
          ...dedupe,
          [change.dedupe.postKey]: change.dedupe.entry,
        });
      }

      if (change.audits !== undefined && change.audits.length > 0) {
        const current = await readAuditLog(this.storage);
        const appended = change.audits.map((event) =>
          AuditEventSchema.parse(event),
        );
        writes[STORAGE_KEYS.audit] = AuditLogSchema.parse(
          [...current, ...appended].slice(-MAX_AUDIT_EVENTS),
        );
      }

      if (change.counters !== undefined) {
        writes[STORAGE_KEYS.counters] = change.counters;
      }

      if (Object.keys(writes).length > 0) {
        await this.storage.setMany(writes);
      }
    });
  }

  #exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(work, work);
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
