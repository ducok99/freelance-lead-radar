import {
  AuditEventSchema,
  ClassifyRequestSchema,
  DraftRequestSchema,
  LeadSchema,
  SCHEMA_VERSION,
  type AuditAction,
  type AuditEvent,
  type ClassifyResult,
  type CounterState,
  type ExtensionMessage,
  type FilterReason,
  type Lead,
  type ProcessingError,
  type RawPost,
  type Settings,
} from "@flr/shared";
import {
  aggregateScore,
  canCallAi,
  gate,
  hardFilters,
  isAutoEligible,
  recordAiCall,
  recordDraftCall,
  transitionLead,
} from "@flr/rules-engine";
import { createUlid } from "../lib/ulid";
import { ChromeStorageLeadStore } from "../lib/lead-store";
import {
  readCounters,
  readSettings,
  readSystemState,
  type KeyValueStorage,
} from "../lib/storage";
import {
  PipelineApiError,
  type PipelineApiClient,
  type PipelineApiErrorCode,
} from "./api-client";

const EMPTY_BREAKDOWN = Object.freeze({
  intent: 0,
  budget: 0,
  fieldMatch: 0,
  urgency: 0,
  contact: 0,
  quality: 0,
  adjustments: [],
});

const TERMINAL_STATUSES = new Set([
  "filtered_out",
  "below_threshold",
  "skipped",
  "won",
  "lost",
]);

interface PendingPost {
  post: RawPost;
  done: Array<() => void>;
}

interface PreparedLead {
  lead: Lead;
  settings: Settings;
}

export interface ReadOnlyPipelinePorts {
  storage: KeyValueStorage;
  api: PipelineApiClient;
  now: () => Date;
  broadcast: (message: ExtensionMessage) => Promise<void>;
  createId?: () => string;
  schedule?: (callback: () => void) => void;
  /**
   * P6.1: được gọi với các lead VỪA chuyển sang needs_review sau phân tích
   * (không gọi lại khi sửa nháp/duyệt/bỏ qua). Lỗi trong notify không được
   * phép ảnh hưởng pipeline — pipeline tự nuốt lỗi này (fail-safe).
   */
  notify?: (leads: readonly Lead[]) => Promise<void>;
}

export interface LeadActionResult {
  ok: boolean;
  code?: "not_found" | "invalid_state" | "unavailable";
  message?: string;
  leads: Lead[];
}

const uniqueReasons = (reasons: readonly FilterReason[]): FilterReason[] => [
  ...new Set(reasons),
];

// Bug 2026-07-20: bài "người tham gia ẩn danh" lúc đầu hiện dạng rút gọn
// (chưa có nội dung) trong feed nhóm — Facebook chỉ hiện đủ nội dung sau khi
// người dùng bấm mở bài. Lần quét đầu (lúc rút gọn) đúng là không đủ chữ nên
// bị lọc insufficient_text — hợp lý. Nhưng vì postKey đã nằm trong dedupe,
// lần quét sau (khi nội dung đầy đủ đã hiện) sẽ bị bỏ qua vĩnh viễn nếu không
// có ngoại lệ này. CHỈ cho xử lý lại khi lý do lọc DUY NHẤT là insufficient_text
// và nội dung mới thực sự khác — mọi lý do lọc khác (ngoài allowlist, giống
// spam, người tự tìm việc, trùng kỹ năng team, hết hạn mức...) vẫn bị dedupe
// như cũ, không xử lý lại.
const isRetryableInsufficientText = (existing: Lead, post: RawPost): boolean =>
  existing.status === "filtered_out" &&
  existing.filterReasons.length === 1 &&
  existing.filterReasons[0] === "insufficient_text" &&
  post.text.trim() !== existing.post.text.trim();

const postInput = (post: RawPost) => ({
  postKey: post.postKey,
  text: post.text,
  anonymousPoster: post.anonymousPoster,
  truncated: post.truncated,
  ...(post.postedAtText === undefined
    ? {}
    : { postedAtText: post.postedAtText }),
});

const normalizeApiError = (error: unknown): ProcessingError => {
  const normalized =
    error instanceof PipelineApiError
      ? error
      : new PipelineApiError(
          "invalid_response",
          "Pipeline gặp dữ liệu không hợp lệ.",
          true,
        );
  return {
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
    occurredAt: new Date().toISOString(),
  };
};

const detectedLead = (post: RawPost, id: string, at: string): Lead =>
  LeadSchema.parse({
    id,
    post,
    classification: "other",
    confidence: 0,
    score: 0,
    scoreBreakdown: EMPTY_BREAKDOWN,
    autoEligible: false,
    extraction: {
      jobSummary:
        post.text.trim().slice(0, 1_000) || "Bài viết chưa có nội dung",
      field: "other",
      tools: [],
      contacts: [],
    },
    status: "detected",
    filterReasons: [],
    label: null,
    assignedTo: null,
    outcome: null,
    schemaVersion: SCHEMA_VERSION,
    createdAt: at,
    updatedAt: at,
  });

export class ReadOnlyPipeline {
  readonly #store: ChromeStorageLeadStore;
  readonly #pending = new Map<string, PendingPost>();
  readonly #createId: () => string;
  readonly #schedule: (callback: () => void) => void;
  #scheduled = false;

  constructor(private readonly ports: ReadOnlyPipelinePorts) {
    this.#store = new ChromeStorageLeadStore(ports.storage);
    this.#createId = ports.createId ?? (() => createUlid());
    this.#schedule =
      ports.schedule ?? ((callback) => globalThis.setTimeout(callback, 25));
  }

  listLeads(): Promise<Lead[]> {
    return this.#store.list();
  }

  async resumeInterrupted(): Promise<void> {
    const now = this.ports.now();
    const at = now.toISOString();
    const [settings, state, counters, leads] = await Promise.all([
      readSettings(this.ports.storage),
      readSystemState(this.ports.storage),
      readCounters(this.ports.storage, now),
      this.#store.list(),
    ]);
    if (state.emergencyStop || state.circuitBreaker.state === "tripped") return;

    let remaining = Math.max(
      0,
      settings.limits.maxAiCallsPerDay - counters.aiCalls,
    );
    const interrupted = leads.filter(
      (lead) =>
        lead.status === "detected" && lead.processingError === undefined,
    );
    let firstChanged: Lead[] = [];

    for (let offset = 0; offset < interrupted.length; offset += 10) {
      const resumable: PreparedLead[] = [];
      for (const lead of interrupted.slice(offset, offset + 10)) {
        const allowlisted = settings.allowlist.some(
          (group) => group.active && group.groupId === lead.post.groupId,
        );
        if (!allowlisted || remaining === 0) {
          const reason: FilterReason = allowlisted
            ? "daily_limit_reached"
            : "group_not_allowlisted";
          const transitioned = transitionLead(lead, "filtered_out", {
            at,
            filterReasons: [reason],
          });
          await this.#store.commit({
            lead: transitioned.lead,
            dedupe: {
              postKey: lead.post.postKey,
              entry: { leadId: lead.id, decidedAt: at, terminal: true },
            },
            audits: [
              this.#audit(
                transitioned.audit.action,
                at,
                transitioned.lead,
                transitioned.audit.detail,
              ),
            ],
          });
          firstChanged.push(transitioned.lead);
          continue;
        }
        remaining -= 1;
        await this.#store.commit({
          audits: [this.#audit("pipeline_resumed", at, lead)],
        });
        resumable.push({ lead, settings });
      }
      if (resumable.length > 0) {
        await this.#analyze(resumable, firstChanged);
        firstChanged = [];
      }
    }
    if (firstChanged.length > 0) await this.#publish(firstChanged);
  }

  enqueue(post: RawPost): Promise<void> {
    return new Promise((resolve) => {
      const pending = this.#pending.get(post.postKey);
      if (pending === undefined) {
        this.#pending.set(post.postKey, { post, done: [resolve] });
      } else {
        pending.done.push(resolve);
      }
      this.#ensureFlush();
    });
  }

  async recordExtractionFailure(): Promise<void> {
    const now = this.ports.now();
    const counters = await readCounters(this.ports.storage, now);
    await this.#store.commit({
      counters: {
        ...counters,
        extractionAttempts: counters.extractionAttempts + 1,
        extractionFailures: counters.extractionFailures + 1,
      },
    });
  }

  async recordSystemAudit(
    action: Extract<
      AuditAction,
      | "emergency_stop_on"
      | "emergency_stop_off"
      | "circuit_tripped"
      | "circuit_reset"
    >,
    detail: Record<string, unknown> = {},
  ): Promise<void> {
    const at = this.ports.now().toISOString();
    await this.#store.commit({
      audits: [this.#audit(action, at, undefined, detail)],
    });
  }

  async reviewLead(
    leadId: string,
    action: "approve" | "skip",
  ): Promise<LeadActionResult> {
    const lead = await this.#store.get(leadId);
    if (lead === undefined)
      return this.#failure("not_found", "Không tìm thấy lead.");
    if (
      lead.status !== "needs_review" ||
      (action === "approve" &&
        (lead.draft === undefined || lead.processingError !== undefined))
    ) {
      return this.#failure(
        "invalid_state",
        "Lead chưa sẵn sàng cho thao tác này.",
      );
    }

    const at = this.ports.now().toISOString();
    const transitioned = transitionLead(
      lead,
      action === "approve" ? "approved" : "skipped",
      { at },
    );
    await this.#store.commit({
      lead: transitioned.lead,
      dedupe: {
        postKey: lead.post.postKey,
        entry: {
          leadId: lead.id,
          decidedAt: at,
          terminal: action === "skip",
        },
      },
      audits: [
        this.#audit(
          transitioned.audit.action,
          at,
          transitioned.lead,
          transitioned.audit.detail,
        ),
      ],
    });
    await this.#publish([transitioned.lead]);
    return { ok: true, leads: await this.#store.list() };
  }

  async editDraft(leadId: string, text: string): Promise<LeadActionResult> {
    const lead = await this.#store.get(leadId);
    if (lead === undefined)
      return this.#failure("not_found", "Không tìm thấy lead.");
    if (lead.status !== "needs_review" || lead.draft === undefined) {
      return this.#failure("invalid_state", "Lead chưa có nháp để chỉnh sửa.");
    }
    const at = this.ports.now().toISOString();
    const candidate: Record<string, unknown> = {
      ...lead,
      draft: { ...lead.draft, editedText: text },
      updatedAt: at,
    };
    delete candidate.processingError;
    const updated = LeadSchema.parse(candidate);
    await this.#store.commit({
      lead: updated,
      audits: [
        this.#audit("draft_edited", at, updated, { length: text.length }),
      ],
    });
    await this.#publish([updated]);
    return { ok: true, leads: await this.#store.list() };
  }

  async retryLead(leadId: string): Promise<LeadActionResult> {
    const lead = await this.#store.get(leadId);
    if (lead === undefined)
      return this.#failure("not_found", "Không tìm thấy lead.");
    if (lead.processingError?.retryable !== true) {
      return this.#failure(
        "invalid_state",
        "Lead này không có lỗi có thể thử lại.",
      );
    }
    const state = await readSystemState(this.ports.storage);
    if (state.emergencyStop || state.circuitBreaker.state === "tripped") {
      return this.#failure("unavailable", "Pipeline đang bị dừng an toàn.");
    }
    const settings = await readSettings(this.ports.storage);
    const counters = await readCounters(this.ports.storage, this.ports.now());
    const allowlisted = settings.allowlist.some(
      (group) => group.active && group.groupId === lead.post.groupId,
    );
    if (!allowlisted || counters.aiCalls >= settings.limits.maxAiCallsPerDay) {
      return this.#failure(
        "unavailable",
        allowlisted
          ? "Đã đạt giới hạn AI trong ngày."
          : "Nhóm của lead không còn trong allowlist.",
      );
    }
    const at = this.ports.now().toISOString();
    const reset = detectedLead(lead.post, lead.id, lead.createdAt);
    const prepared = LeadSchema.parse({ ...reset, updatedAt: at });
    await this.#store.commit({
      lead: prepared,
      audits: [
        this.#audit("retry_requested", at, prepared, {
          previousError: lead.processingError.code,
        }),
      ],
    });
    await this.#analyze([{ lead: prepared, settings }], []);
    return { ok: true, leads: await this.#store.list() };
  }

  #ensureFlush(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    this.#schedule(() => void this.#flush());
  }

  async #flush(): Promise<void> {
    const batch = [...this.#pending.values()].slice(0, 10);
    for (const item of batch) this.#pending.delete(item.post.postKey);
    this.#scheduled = false;
    try {
      await this.#processBatch(batch.map((item) => item.post));
    } finally {
      for (const item of batch) item.done.forEach((done) => done());
      if (this.#pending.size > 0) this.#ensureFlush();
    }
  }

  async #processBatch(posts: readonly RawPost[]): Promise<void> {
    const now = this.ports.now();
    const at = now.toISOString();
    const [settings, state, initialCounters] = await Promise.all([
      readSettings(this.ports.storage),
      readSystemState(this.ports.storage),
      readCounters(this.ports.storage, now),
    ]);
    if (state.emergencyStop || state.circuitBreaker.state === "tripped") return;

    let availableAiCalls = Math.max(
      0,
      settings.limits.maxAiCallsPerDay - initialCounters.aiCalls,
    );
    const prepared: PreparedLead[] = [];
    const changed: Lead[] = [];

    for (const post of posts) {
      const existing = await this.#store.findByPostKey(post.postKey);
      if (existing === undefined) {
        // dedupe có thể còn key mồ côi (lead đã bị dọn) — vẫn coi là đã xử lý
        // để an toàn, giữ đúng hành vi cũ.
        if (await this.#store.hasPost(post.postKey)) continue;
      } else if (!isRetryableInsufficientText(existing, post)) {
        continue;
      }
      const allowlisted = settings.allowlist.some(
        (group) => group.active && group.groupId === post.groupId,
      );
      if (!allowlisted) continue;

      const decision = gate({
        text: post.text,
        teamSkills: settings.teamSkills,
        groupAllowlisted: true,
        alreadyProcessed: false,
        systemState: state,
        counters: initialCounters,
        limits: settings.limits,
        now,
      });
      const lead =
        existing === undefined
          ? detectedLead(post, this.#createId(), at)
          : LeadSchema.parse({
              ...detectedLead(post, existing.id, existing.createdAt),
              updatedAt: at,
            });
      const detectedAudit = this.#audit(
        "post_detected",
        at,
        lead,
        existing === undefined ? {} : { reprocessedAfter: "insufficient_text" },
      );
      let filterReasons = decision.blockReasons.filter(
        (reason): reason is FilterReason => reason !== "emergency_stop",
      );
      if (decision.shouldCallAi && availableAiCalls === 0) {
        filterReasons = [...filterReasons, "daily_limit_reached"];
      }

      if (!decision.shouldCallAi || availableAiCalls === 0) {
        if (filterReasons.length === 0) continue;
        const transitioned = transitionLead(lead, "filtered_out", {
          at,
          filterReasons: uniqueReasons(filterReasons),
        });
        await this.#store.commit({
          lead: transitioned.lead,
          dedupe: {
            postKey: post.postKey,
            entry: { leadId: lead.id, decidedAt: at, terminal: true },
          },
          audits: [
            detectedAudit,
            this.#audit(
              transitioned.audit.action,
              at,
              transitioned.lead,
              transitioned.audit.detail,
            ),
          ],
        });
        changed.push(transitioned.lead);
        continue;
      }

      availableAiCalls -= 1;
      await this.#store.commit({
        lead,
        dedupe: {
          postKey: post.postKey,
          entry: { leadId: lead.id, decidedAt: at, terminal: false },
        },
        audits: [detectedAudit],
      });
      prepared.push({ lead, settings });
    }

    await this.#analyze(prepared, changed);
  }

  async #analyze(
    prepared: readonly PreparedLead[],
    alreadyChanged: readonly Lead[],
  ): Promise<void> {
    if (prepared.length === 0) {
      if (alreadyChanged.length > 0) await this.#publish(alreadyChanged);
      return;
    }
    const settings = prepared[0]!.settings;
    const now = this.ports.now();
    const at = now.toISOString();
    let counters = await readCounters(this.ports.storage, now);
    let results: readonly ClassifyResult[];

    try {
      const request = ClassifyRequestSchema.parse({
        posts: prepared.map(({ lead }) => postInput(lead.post)),
        teamSkills: settings.teamSkills,
        schemaVersion: SCHEMA_VERSION,
      });
      const response = await this.ports.api.classify(request, settings);
      results = response.results;
      for (let index = 0; index < prepared.length; index += 1) {
        counters = recordAiCall(counters, now, true);
      }
    } catch (error) {
      const processingError = this.#processingError(error, at);
      if (processingError.code !== "configuration_missing") {
        for (let index = 0; index < prepared.length; index += 1) {
          counters = recordAiCall(counters, now, false);
        }
      }
      const failed: Lead[] = [];
      for (const { lead } of prepared) {
        const updated = LeadSchema.parse({
          ...lead,
          processingError,
          updatedAt: at,
        });
        await this.#store.commit({
          lead: updated,
          audits: [
            this.#audit("ai_error", at, updated, {
              code: processingError.code,
              retryable: processingError.retryable,
            }),
          ],
        });
        failed.push(updated);
      }
      await this.#store.commit({ counters });
      await this.#publish([...alreadyChanged, ...failed]);
      return;
    }

    const byPostKey = new Map(
      results.map((result) => [result.postKey, result]),
    );
    const changed: Lead[] = [...alreadyChanged];
    const freshReview: Lead[] = [];

    for (const item of prepared) {
      const result = byPostKey.get(item.lead.post.postKey);
      if (result === undefined) {
        const processingError = this.#processingError(
          new PipelineApiError(
            "invalid_response",
            "API thiếu kết quả cho một bài viết.",
            true,
          ),
          at,
        );
        const failed = LeadSchema.parse({
          ...item.lead,
          processingError,
          updatedAt: at,
        });
        await this.#store.commit({
          lead: failed,
          audits: [
            this.#audit("ai_error", at, failed, {
              code: processingError.code,
              retryable: true,
            }),
          ],
        });
        changed.push(failed);
        continue;
      }
      const analyzed = await this.#applyClassification(
        item.lead,
        result,
        item.settings,
        counters,
      );
      counters = analyzed.counters;
      changed.push(analyzed.lead);
      if (analyzed.lead.status === "needs_review") {
        freshReview.push(analyzed.lead);
      }
    }

    await this.#store.commit({ counters });
    await this.#publish(changed);

    // P6.1: thông báo lead mới SAU khi đã lưu và phát LEADS_UPDATED. Lỗi
    // thông báo (vd API notifications hỏng) không được làm hỏng pipeline.
    if (freshReview.length > 0 && this.ports.notify !== undefined) {
      try {
        await this.ports.notify(freshReview);
      } catch {
        // Cố tình nuốt lỗi — xem chú thích tại ReadOnlyPipelinePorts.notify.
      }
    }
  }

  async #applyClassification(
    detected: Lead,
    result: ClassifyResult,
    settings: Settings,
    currentCounters: CounterState,
  ): Promise<{ lead: Lead; counters: CounterState }> {
    const at = this.ports.now().toISOString();
    const postFilter = hardFilters({
      phase: "post_ai",
      text: detected.post.text,
      classification: result.classification,
      extractionField: result.extraction.field,
      teamSkills: settings.teamSkills,
    });
    const aggregate = aggregateScore(result.scoreBreakdown, result.confidence);
    const base = LeadSchema.parse({
      ...detected,
      classification: result.classification,
      confidence: result.confidence,
      score: aggregate.score,
      scoreBreakdown: result.scoreBreakdown,
      autoEligible: isAutoEligible({
        score: aggregate.score,
        confidence: result.confidence,
        classification: result.classification,
        filterReasons: postFilter.reasons,
      }),
      extraction: result.extraction,
      filterReasons: postFilter.reasons,
      updatedAt: at,
    });

    const target =
      postFilter.reasons.length > 0 || postFilter.classificationRejected
        ? "filtered_out"
        : aggregate.score < 75
          ? "below_threshold"
          : "needs_review";
    const reasons =
      postFilter.reasons.length > 0
        ? postFilter.reasons
        : postFilter.classificationRejected
          ? (["classification_rejected"] as const)
          : [];
    const transitioned = transitionLead(base, target, {
      at,
      filterReasons: reasons,
    });
    const audits: AuditEvent[] = [
      this.#audit(transitioned.audit.action, at, transitioned.lead, {
        ...transitioned.audit.detail,
        score: transitioned.lead.score,
        classification: transitioned.lead.classification,
      }),
    ];
    let lead = transitioned.lead;
    let counters = currentCounters;

    if (target === "needs_review") {
      const counterDecision = canCallAi(counters, settings.limits, at);
      if (!counterDecision.allowed) {
        lead = LeadSchema.parse({
          ...lead,
          processingError: {
            code: "api_error",
            message: "Đã đạt giới hạn AI trong ngày; hãy thử lại ngày mai.",
            retryable: true,
            occurredAt: at,
          },
        });
        audits.push(
          this.#audit("ai_error", at, lead, {
            code: "daily_limit_reached",
            retryable: true,
          }),
        );
      } else if (settings.teamProfile.trim().length === 0) {
        lead = LeadSchema.parse({
          ...lead,
          processingError: {
            code: "configuration_missing",
            message: "Hãy nhập hồ sơ năng lực team để tạo nháp.",
            retryable: true,
            occurredAt: at,
          },
        });
        audits.push(
          this.#audit("ai_error", at, lead, {
            code: "configuration_missing",
            retryable: true,
          }),
        );
      } else {
        try {
          const draftRequest = DraftRequestSchema.parse({
            postKey: lead.post.postKey,
            postText: lead.post.text,
            extraction: lead.extraction,
            score: lead.score,
            teamProfile: settings.teamProfile,
            schemaVersion: SCHEMA_VERSION,
          });
          const response = await this.ports.api.draft(draftRequest, settings);
          counters = recordDraftCall(counters, at);
          lead = LeadSchema.parse({
            ...lead,
            draft: response.draft,
            updatedAt: at,
          });
          audits.push(this.#audit("draft_created", at, lead));
        } catch (error) {
          counters = recordDraftCall(counters, at);
          const processingError = this.#processingError(error, at);
          lead = LeadSchema.parse({
            ...lead,
            processingError,
            updatedAt: at,
          });
          audits.push(
            this.#audit("ai_error", at, lead, {
              code: processingError.code,
              retryable: processingError.retryable,
            }),
          );
        }
      }
    }

    await this.#store.commit({
      lead,
      dedupe: {
        postKey: lead.post.postKey,
        entry: {
          leadId: lead.id,
          decidedAt: at,
          terminal: TERMINAL_STATUSES.has(lead.status),
        },
      },
      audits,
    });
    return { lead, counters };
  }

  async #publish(changed: readonly Lead[]): Promise<void> {
    for (const lead of changed) {
      await this.ports.broadcast({
        type: "POST_SCORE_UPDATED",
        postKey: lead.post.postKey,
        score: lead.score,
        status: lead.status,
      });
    }
    await this.ports.broadcast({
      type: "LEADS_UPDATED",
      leads: await this.#store.list(),
    });
  }

  #processingError(error: unknown, at: string): ProcessingError {
    const normalized = normalizeApiError(error);
    return { ...normalized, occurredAt: at };
  }

  #audit(
    action: AuditAction,
    ts: string,
    lead?: Lead,
    detail: Record<string, unknown> = {},
  ): AuditEvent {
    return AuditEventSchema.parse({
      id: this.#createId(),
      ts,
      actor:
        action === "approved" ||
        action === "skipped" ||
        action === "draft_edited" ||
        action === "retry_requested"
          ? "user"
          : "system",
      action,
      ...(lead === undefined
        ? {}
        : { leadId: lead.id, postKey: lead.post.postKey }),
      detail,
      schemaVersion: SCHEMA_VERSION,
    });
  }

  async #failure(
    code: "not_found" | "invalid_state" | "unavailable",
    message: string,
  ): Promise<LeadActionResult> {
    return { ok: false, code, message, leads: await this.#store.list() };
  }
}

export type { PipelineApiErrorCode };
