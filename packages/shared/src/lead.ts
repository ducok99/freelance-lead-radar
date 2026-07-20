import { z } from "zod";
import {
  AUTO_REPLY_MIN_CONFIDENCE,
  SCHEMA_VERSION,
  SCORE_THRESHOLDS,
} from "./constants";
import {
  ClassificationSchema,
  FilterReasonSchema,
  LeadLabelSchema,
  LeadOutcomeSchema,
  LeadStatusSchema,
} from "./enums";
import { ExtractionSchema } from "./extraction";
import {
  ConfidenceSchema,
  IsoDateTimeSchema,
  SchemaVersionSchema,
  ScoreSchema,
  UlidSchema,
} from "./primitives";
import { RawPostSchema } from "./post";

export const ScoreAdjustmentSchema = z
  .object({
    reason: z.string().trim().min(1).max(120),
    delta: z.number().int().min(-100).max(100),
  })
  .strict();
export type ScoreAdjustment = z.infer<typeof ScoreAdjustmentSchema>;

export const ScoreBreakdownSchema = z
  .object({
    intent: z.number().int().min(0).max(40),
    budget: z.number().int().min(0).max(15),
    fieldMatch: z.number().int().min(0).max(15),
    urgency: z.number().int().min(0).max(10),
    contact: z.number().int().min(0).max(10),
    quality: z.number().int().min(0).max(10),
    adjustments: z.array(ScoreAdjustmentSchema).max(50).default([]),
  })
  .strict();
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const ReplyDraftSchema = z
  .object({
    aiText: z.string().trim().min(1).max(2_000),
    editedText: z.string().trim().min(1).max(2_000).optional(),
    rationale: z.string().trim().min(1).max(1_000),
    createdAt: IsoDateTimeSchema,
  })
  .strict();
export type ReplyDraft = z.infer<typeof ReplyDraftSchema>;

export const ProcessingErrorSchema = z
  .object({
    code: z.enum([
      "configuration_missing",
      "network_error",
      "api_error",
      "invalid_response",
    ]),
    message: z.string().trim().min(1).max(300),
    retryable: z.boolean(),
    occurredAt: IsoDateTimeSchema,
  })
  .strict();
export type ProcessingError = z.infer<typeof ProcessingErrorSchema>;

export const LeadSchema = z
  .object({
    id: UlidSchema,
    post: RawPostSchema,
    classification: ClassificationSchema,
    confidence: ConfidenceSchema,
    score: ScoreSchema,
    scoreBreakdown: ScoreBreakdownSchema,
    autoEligible: z.boolean(),
    extraction: ExtractionSchema,
    status: LeadStatusSchema,
    filterReasons: z.array(FilterReasonSchema).default([]),
    draft: ReplyDraftSchema.optional(),
    processingError: ProcessingErrorSchema.optional(),
    finalComment: z.string().trim().min(1).max(2_000).optional(),
    approvedAt: IsoDateTimeSchema.optional(),
    commentedAt: IsoDateTimeSchema.optional(),
    skippedAt: IsoDateTimeSchema.optional(),
    assignedTo: UlidSchema.nullable().optional(),
    label: LeadLabelSchema.nullable().default(null),
    labelNote: z.string().trim().min(1).max(1_000).optional(),
    outcome: LeadOutcomeSchema.nullable().default(null),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((lead, context) => {
    if (
      lead.autoEligible &&
      (lead.score < SCORE_THRESHOLDS.autoEligibleFrom ||
        lead.confidence < AUTO_REPLY_MIN_CONFIDENCE ||
        lead.classification !== "hiring_freelancer" ||
        lead.filterReasons.length > 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["autoEligible"],
        message:
          "autoEligible yêu cầu đúng nhu cầu thuê freelancer, không có filterReason, score >= 95 và confidence >= 0.85",
      });
    }

    if (lead.status === "filtered_out" && lead.filterReasons.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filterReasons"],
        message: "Lead filtered_out phải có ít nhất một filterReason",
      });
    }

    if (
      lead.status === "below_threshold" &&
      lead.score >= SCORE_THRESHOLDS.ignoreBelow
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Lead below_threshold phải có score dưới 75",
      });
    }

    const reviewableStatuses = new Set([
      "needs_review",
      "skipped",
      "approved",
      "comment_inserted",
      "commented",
      "assigned",
      "won",
      "lost",
    ]);
    if (
      reviewableStatuses.has(lead.status) &&
      lead.score < SCORE_THRESHOLDS.ignoreBelow
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Trạng thái xử lý lead yêu cầu score từ 75 trở lên",
      });
    }

    if (Date.parse(lead.createdAt) > Date.parse(lead.updatedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updatedAt"],
        message: "updatedAt không được sớm hơn createdAt",
      });
    }

    for (const field of ["approvedAt", "commentedAt", "skippedAt"] as const) {
      const timestamp = lead[field];
      if (
        timestamp !== undefined &&
        (Date.parse(timestamp) < Date.parse(lead.createdAt) ||
          Date.parse(timestamp) > Date.parse(lead.updatedAt))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} phải nằm trong khoảng createdAt đến updatedAt`,
        });
      }
    }

    const approvedStatuses = new Set([
      "approved",
      "comment_inserted",
      "commented",
      "assigned",
      "won",
      "lost",
    ]);
    if (approvedStatuses.has(lead.status) && lead.approvedAt === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approvedAt"],
        message: "Trạng thái sau duyệt yêu cầu approvedAt",
      });
    }

    if (lead.status === "skipped" && lead.skippedAt === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skippedAt"],
        message: "Lead skipped yêu cầu skippedAt",
      });
    }

    const commentStatuses = new Set(["comment_inserted", "commented"]);
    if (commentStatuses.has(lead.status) && lead.finalComment === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finalComment"],
        message: "Trạng thái bình luận yêu cầu finalComment",
      });
    }

    if (lead.status === "commented" && lead.commentedAt === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commentedAt"],
        message: "Lead commented yêu cầu commentedAt",
      });
    }

    if (
      lead.approvedAt !== undefined &&
      lead.commentedAt !== undefined &&
      Date.parse(lead.commentedAt) < Date.parse(lead.approvedAt)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commentedAt"],
        message: "commentedAt không được sớm hơn approvedAt",
      });
    }

    const outcomeStatuses = new Set(["assigned", "won", "lost"]);
    if (outcomeStatuses.has(lead.status) && lead.assignedTo == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedTo"],
        message: "Trạng thái phân công/kết quả yêu cầu assignedTo",
      });
    }

    const expectedOutcome =
      lead.status === "won" ? "won" : lead.status === "lost" ? "lost" : null;
    if (lead.outcome !== expectedOutcome) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outcome"],
        message: "outcome phải khớp với trạng thái won/lost",
      });
    }

    if (lead.labelNote !== undefined && lead.label === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["labelNote"],
        message: "labelNote yêu cầu label đúng hoặc sai",
      });
    }
  });
export type Lead = z.infer<typeof LeadSchema>;

export const LeadMapSchema = z
  .record(UlidSchema, LeadSchema)
  .superRefine((leads, context) => {
    for (const [id, lead] of Object.entries(leads)) {
      if (lead.id !== id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [id, "id"],
          message: "Khóa LeadMap phải trùng với lead.id",
        });
      }
    }
  });
export type LeadMap = z.infer<typeof LeadMapSchema>;
