import { AuditEventSchema, LeadSchema, STORAGE_KEYS } from "@flr/shared";
import { describe, expect, it } from "vitest";
import { MemoryStorage } from "../test/memory-storage";
import { createDefaultCounters } from "./storage";
import { ChromeStorageLeadStore } from "./lead-store";

describe("ChromeStorageLeadStore", () => {
  it("commit lead, dedupe, audit và counters trong một lần ghi", async () => {
    const storage = new MemoryStorage();
    const store = new ChromeStorageLeadStore(storage);
    const now = "2026-07-20T08:00:00.000Z";
    const lead = LeadSchema.parse({
      id: "01J2ZK8Q9M3T5V7X9A1C3E5G7J",
      post: {
        postKey: "group:post",
        groupId: "group",
        permalink: "https://www.facebook.com/groups/group/posts/post/",
        text: "Cần thuê freelancer thiết kế logo cho dự án.",
        seenAt: now,
      },
      classification: "hiring_freelancer",
      confidence: 0.93,
      score: 88,
      scoreBreakdown: {
        intent: 38,
        budget: 10,
        fieldMatch: 15,
        urgency: 8,
        contact: 7,
        quality: 10,
      },
      autoEligible: false,
      extraction: {
        jobSummary: "Thiết kế logo",
        field: "graphic_design",
      },
      status: "needs_review",
      createdAt: now,
      updatedAt: now,
    });
    const counters = createDefaultCounters(new Date(now));

    await store.commit({
      lead,
      dedupe: {
        postKey: lead.post.postKey,
        entry: { leadId: lead.id, decidedAt: now, terminal: false },
      },
      audits: [
        AuditEventSchema.parse({
          id: "01J2ZK8Q9M3T5V7X9A1C3E5G7M",
          ts: now,
          actor: "system",
          action: "ai_classified",
          leadId: lead.id,
          postKey: lead.post.postKey,
          detail: { score: 88 },
        }),
      ],
      counters,
    });

    await expect(store.list()).resolves.toEqual([lead]);
    await expect(store.findByPostKey(lead.post.postKey)).resolves.toEqual(lead);
    await expect(store.audits()).resolves.toHaveLength(1);
    expect(storage.values.get(STORAGE_KEYS.counters)).toEqual(counters);
  });

  it("storage hỏng fail-closed về danh sách rỗng", async () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEYS.leads, { broken: true });
    storage.values.set(STORAGE_KEYS.dedupe, { broken: true });
    storage.values.set(STORAGE_KEYS.audit, [{ token: "secret" }]);
    const store = new ChromeStorageLeadStore(storage);

    await expect(store.list()).resolves.toEqual([]);
    await expect(store.hasPost("group:post")).resolves.toBe(false);
    await expect(store.audits()).resolves.toEqual([]);
  });
});
