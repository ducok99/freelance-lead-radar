import { z } from "zod";
import { LeadSchema } from "./lead";
import {
  IsoDateTimeSchema,
  PostKeySchema,
  ScoreSchema,
  UlidSchema,
} from "./primitives";
import { RawPostSchema } from "./post";
import { SystemStateSchema } from "./state";
import { LeadStatusSchema, WarningReasonSchema } from "./enums";

const GetGateStateMessageSchema = z
  .object({ type: z.literal("GET_GATE_STATE") })
  .strict();

const GateStateMessageSchema = z
  .object({
    type: z.literal("GATE_STATE"),
    allowlisted: z.boolean(),
    systemState: SystemStateSchema,
  })
  .strict();

const PostSeenMessageSchema = z
  .object({
    type: z.literal("POST_SEEN"),
    post: RawPostSchema,
  })
  .strict();

const ExtractionFailedMessageSchema = z
  .object({
    type: z.literal("EXTRACTION_FAILED"),
    code: z.enum([
      "invalid_element",
      "missing_permalink",
      "missing_text",
      "invalid_post",
    ]),
  })
  .strict();

const InsertCommentMessageSchema = z
  .object({
    type: z.literal("INSERT_COMMENT"),
    leadId: UlidSchema,
    postKey: PostKeySchema,
    text: z.string().trim().min(1).max(2_000),
  })
  .strict();

const CommentConfirmedMessageSchema = z
  .object({
    type: z.literal("COMMENT_CONFIRMED"),
    leadId: UlidSchema,
    postKey: PostKeySchema,
    confirmedAt: IsoDateTimeSchema,
  })
  .strict();

const WarningDetectedMessageSchema = z
  .object({
    type: z.literal("WARNING_DETECTED"),
    reason: WarningReasonSchema,
    detectedAt: IsoDateTimeSchema,
  })
  .strict();

const SetEmergencyStopMessageSchema = z
  .object({
    type: z.literal("SET_EMERGENCY_STOP"),
    enabled: z.boolean(),
  })
  .strict();

const EmergencyStopChangedMessageSchema = z
  .object({
    type: z.literal("EMERGENCY_STOP_CHANGED"),
    enabled: z.boolean(),
  })
  .strict();

const ResetCircuitBreakerMessageSchema = z
  .object({ type: z.literal("RESET_CIRCUIT_BREAKER") })
  .strict();

const LeadsUpdatedMessageSchema = z
  .object({
    type: z.literal("LEADS_UPDATED"),
    leads: z.array(LeadSchema),
  })
  .strict();

const GetLeadsMessageSchema = z
  .object({ type: z.literal("GET_LEADS") })
  .strict();

const ReviewLeadMessageSchema = z
  .object({
    type: z.literal("REVIEW_LEAD"),
    leadId: UlidSchema,
    action: z.enum(["approve", "skip"]),
  })
  .strict();

const EditLeadDraftMessageSchema = z
  .object({
    type: z.literal("EDIT_LEAD_DRAFT"),
    leadId: UlidSchema,
    text: z.string().trim().min(1).max(2_000),
  })
  .strict();

const RetryLeadMessageSchema = z
  .object({
    type: z.literal("RETRY_LEAD"),
    leadId: UlidSchema,
  })
  .strict();

const PostScoreUpdatedMessageSchema = z
  .object({
    type: z.literal("POST_SCORE_UPDATED"),
    postKey: PostKeySchema,
    score: ScoreSchema,
    status: LeadStatusSchema,
  })
  .strict();

const ActionErrorMessageSchema = z
  .object({
    type: z.literal("ACTION_ERROR"),
    code: z.enum(["not_found", "invalid_state", "unavailable"]),
    message: z.string().trim().min(1).max(300),
  })
  .strict();

export const ExtensionMessageSchema = z.discriminatedUnion("type", [
  GetGateStateMessageSchema,
  GateStateMessageSchema,
  PostSeenMessageSchema,
  ExtractionFailedMessageSchema,
  InsertCommentMessageSchema,
  CommentConfirmedMessageSchema,
  WarningDetectedMessageSchema,
  SetEmergencyStopMessageSchema,
  EmergencyStopChangedMessageSchema,
  ResetCircuitBreakerMessageSchema,
  LeadsUpdatedMessageSchema,
  GetLeadsMessageSchema,
  ReviewLeadMessageSchema,
  EditLeadDraftMessageSchema,
  RetryLeadMessageSchema,
  PostScoreUpdatedMessageSchema,
  ActionErrorMessageSchema,
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

export const ContentToBackgroundMessageSchema = z.discriminatedUnion("type", [
  GetGateStateMessageSchema,
  PostSeenMessageSchema,
  ExtractionFailedMessageSchema,
  CommentConfirmedMessageSchema,
  WarningDetectedMessageSchema,
]);
export type ContentToBackgroundMessage = z.infer<
  typeof ContentToBackgroundMessageSchema
>;

export const BackgroundToContentMessageSchema = z.discriminatedUnion("type", [
  GateStateMessageSchema,
  InsertCommentMessageSchema,
  EmergencyStopChangedMessageSchema,
  PostScoreUpdatedMessageSchema,
]);
export type BackgroundToContentMessage = z.infer<
  typeof BackgroundToContentMessageSchema
>;

export const UiToBackgroundMessageSchema = z.discriminatedUnion("type", [
  SetEmergencyStopMessageSchema,
  ResetCircuitBreakerMessageSchema,
  GetLeadsMessageSchema,
  ReviewLeadMessageSchema,
  EditLeadDraftMessageSchema,
  RetryLeadMessageSchema,
]);
export type UiToBackgroundMessage = z.infer<typeof UiToBackgroundMessageSchema>;

export const BackgroundToUiMessageSchema = z.discriminatedUnion("type", [
  LeadsUpdatedMessageSchema,
  EmergencyStopChangedMessageSchema,
  ActionErrorMessageSchema,
]);
export type BackgroundToUiMessage = z.infer<typeof BackgroundToUiMessageSchema>;
