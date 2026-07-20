import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  type ClassifyRequest,
  type ClassifyResponse,
  type DraftResponse,
  type RawPost,
  type Settings,
} from "@flr/shared";
import { describe, expect, it, vi } from "vitest";
import { ChromeStorageLeadStore } from "../lib/lead-store";
import { createUlid } from "../lib/ulid";
import { MemoryStorage } from "../test/memory-storage";
import { PipelineApiError, type PipelineApiClient } from "./api-client";
import { ReadOnlyPipeline } from "./pipeline";

const NOW = "2026-07-20T08:00:00.000Z";

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  allowlist: [
    {
      groupId: "allowed",
      name: "Allowed",
      url: "https://www.facebook.com/groups/allowed",
      active: true,
    },
  ],
  teamSkills: ["graphic_design", "video_editing"],
  teamProfile: "Team chuyên thiết kế và dựng video ngắn.",
  apiBaseUrl: "https://flr-api.example.workers.dev",
  teamToken: "a".repeat(32),
};

const rawPost = (id: string, text: string): RawPost => ({
  postKey: `allowed:${id}`,
  groupId: "allowed",
  permalink: `https://www.facebook.com/groups/allowed/posts/${id}/`,
  text,
  anonymousPoster: false,
  truncated: false,
  seenAt: NOW,
});

const classification = (
  request: ClassifyRequest,
  score = 88,
): ClassifyResponse => ({
  results: request.posts.map((post) => ({
    postKey: post.postKey,
    classification: "hiring_freelancer",
    confidence: 0.93,
    scoreBreakdown: {
      intent: Math.min(40, score),
      budget: score >= 50 ? 10 : 0,
      fieldMatch: score >= 60 ? 15 : 0,
      urgency: score >= 70 ? 8 : 0,
      contact: score >= 80 ? 7 : 0,
      quality: Math.max(0, score - 80),
      adjustments: [],
    },
    extraction: {
      jobSummary: post.text,
      field: "graphic_design",
      tools: [],
      contacts: [],
    },
  })),
  schemaVersion: 1,
});

const draftResponse: DraftResponse = {
  draft: {
    aiText:
      "Team mình phù hợp nhu cầu này, bạn nhắn mình để xem portfolio nhé.",
    rationale: "Bám đúng nhu cầu và có CTA nhẹ.",
    createdAt: NOW,
  },
  schemaVersion: 1,
};

const setup = (api?: PipelineApiClient) => {
  const storage = new MemoryStorage();
  storage.values.set(STORAGE_KEYS.settings, settings);
  let scheduled: (() => void) | undefined;
  let idCounter = 1;
  const defaultApi: PipelineApiClient = {
    classify: vi.fn((request) => Promise.resolve(classification(request))),
    draft: vi.fn(() => Promise.resolve(draftResponse)),
  };
  const broadcast = vi.fn(() => Promise.resolve());
  const pipeline = new ReadOnlyPipeline({
    storage,
    api: api ?? defaultApi,
    now: () => new Date(NOW),
    broadcast,
    createId: () =>
      createUlid(
        Date.parse(NOW),
        new Uint8Array(16).fill((idCounter++ % 31) + 1),
      ),
    schedule(callback) {
      scheduled = callback;
    },
  });
  const flush = async () => {
    const callback = scheduled;
    scheduled = undefined;
    if (callback === undefined) throw new Error("Pipeline chưa schedule flush");
    callback();
    await Promise.resolve();
  };
  return { storage, pipeline, api: api ?? defaultApi, broadcast, flush };
};

describe("ReadOnlyPipeline P6", () => {
  it("batch, pre-filter, dedupe và audit đầy đủ", async () => {
    const { storage, pipeline, api, broadcast, flush } = setup();
    const hiring = rawPost(
      "101",
      "Cần thuê designer thiết kế logo, có budget.",
    );
    const seeking = rawPost(
      "102",
      "Mình đang nhận job thiết kế, đây là portfolio của mình.",
    );

    const first = pipeline.enqueue(hiring);
    const second = pipeline.enqueue(seeking);
    await flush();
    await Promise.all([first, second]);

    const leads = await pipeline.listLeads();
    expect(leads.map((lead) => lead.status).sort()).toEqual([
      "filtered_out",
      "needs_review",
    ]);
    expect(api.classify).toHaveBeenCalledOnce();
    expect(api.classify).toHaveBeenCalledWith(
      expect.objectContaining({
        posts: [expect.objectContaining({ postKey: hiring.postKey })],
      }),
      settings,
    );
    expect(api.draft).toHaveBeenCalledOnce();
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LEADS_UPDATED" }),
    );

    const store = new ChromeStorageLeadStore(storage);
    expect((await store.audits()).map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "post_detected",
        "filtered",
        "ai_classified",
        "draft_created",
      ]),
    );

    const duplicate = pipeline.enqueue(hiring);
    await flush();
    await duplicate;
    expect(api.classify).toHaveBeenCalledOnce();
  });

  it("sửa nháp và duyệt chỉ đổi dữ liệu local kèm audit", async () => {
    const { storage, pipeline, flush } = setup();
    const pending = pipeline.enqueue(
      rawPost("103", "Cần thuê designer thiết kế logo, có budget."),
    );
    await flush();
    await pending;
    const [lead] = await pipeline.listLeads();
    if (lead === undefined) throw new Error("Thiếu lead test");

    const edited = await pipeline.editDraft(
      lead.id,
      "Team mình nhận được, bạn nhắn để trao đổi portfolio nhé.",
    );
    expect(edited.ok).toBe(true);
    expect(edited.leads[0]?.draft?.editedText).toContain("portfolio");

    const approved = await pipeline.reviewLead(lead.id, "approve");
    expect(approved.ok).toBe(true);
    expect(approved.leads[0]?.status).toBe("approved");
    const actions = (await new ChromeStorageLeadStore(storage).audits()).map(
      (event) => event.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(["draft_edited", "approved"]),
    );
  });

  it("lỗi API giữ lead để retry tay, retry không mất post", async () => {
    let attempts = 0;
    const api: PipelineApiClient = {
      classify: vi.fn((request) => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(
              new PipelineApiError("network_error", "Mất mạng", true),
            )
          : Promise.resolve(classification(request));
      }),
      draft: vi.fn(() => Promise.resolve(draftResponse)),
    };
    const { pipeline, flush } = setup(api);
    const post = rawPost("104", "Cần thuê designer thiết kế logo, có budget.");
    const pending = pipeline.enqueue(post);
    await flush();
    await pending;

    const [failed] = await pipeline.listLeads();
    expect(failed?.status).toBe("detected");
    expect(failed?.processingError).toMatchObject({
      code: "network_error",
      retryable: true,
    });
    if (failed === undefined) throw new Error("Thiếu lead lỗi");

    const retried = await pipeline.retryLead(failed.id);
    expect(retried.ok).toBe(true);
    expect(retried.leads[0]).toMatchObject({
      post: { postKey: post.postKey },
      status: "needs_review",
    });
    expect(retried.leads[0]?.processingError).toBeUndefined();
    expect(api.classify).toHaveBeenCalledTimes(2);
  });

  it("tự tiếp tục lead detected nếu service worker bị dừng giữa chừng", async () => {
    let attempts = 0;
    const api: PipelineApiClient = {
      classify: vi.fn((request) => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(
              new PipelineApiError("network_error", "Mất mạng", true),
            )
          : Promise.resolve(classification(request));
      }),
      draft: vi.fn(() => Promise.resolve(draftResponse)),
    };
    const { storage, pipeline, flush } = setup(api);
    const pending = pipeline.enqueue(
      rawPost("105", "Cần thuê designer thiết kế logo, có budget."),
    );
    await flush();
    await pending;
    const [failed] = await pipeline.listLeads();
    if (failed === undefined) throw new Error("Thiếu lead lỗi");

    const interrupted = { ...failed };
    delete interrupted.processingError;
    storage.values.set(STORAGE_KEYS.leads, { [failed.id]: interrupted });
    await pipeline.resumeInterrupted();

    const [resumed] = await pipeline.listLeads();
    expect(resumed?.status).toBe("needs_review");
    expect(api.classify).toHaveBeenCalledTimes(2);
    const actions = (await new ChromeStorageLeadStore(storage).audits()).map(
      (event) => event.action,
    );
    expect(actions).toContain("pipeline_resumed");
  });

  it("retry bị chặn nếu nhóm đã bị tắt khỏi allowlist", async () => {
    const api: PipelineApiClient = {
      classify: vi.fn(() =>
        Promise.reject(new PipelineApiError("network_error", "Mất mạng", true)),
      ),
      draft: vi.fn(() => Promise.resolve(draftResponse)),
    };
    const { storage, pipeline, flush } = setup(api);
    const pending = pipeline.enqueue(
      rawPost("106", "Cần thuê designer thiết kế logo, có budget."),
    );
    await flush();
    await pending;
    const [failed] = await pipeline.listLeads();
    if (failed === undefined) throw new Error("Thiếu lead lỗi");
    storage.values.set(STORAGE_KEYS.settings, {
      ...settings,
      allowlist: settings.allowlist.map((group) => ({
        ...group,
        active: false,
      })),
    });

    await expect(pipeline.retryLead(failed.id)).resolves.toMatchObject({
      ok: false,
      code: "unavailable",
    });
    expect(api.classify).toHaveBeenCalledOnce();
  });

  it("extraction failure chỉ tăng counters, không tạo lead", async () => {
    const { storage, pipeline } = setup();
    await pipeline.recordExtractionFailure();
    expect(storage.values.get(STORAGE_KEYS.counters)).toMatchObject({
      extractionAttempts: 1,
      extractionFailures: 1,
    });
    await expect(pipeline.listLeads()).resolves.toEqual([]);
  });
});
