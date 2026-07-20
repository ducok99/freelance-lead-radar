import { z } from "zod";
import { LeadSchema } from "./lead";
import { IsoDateTimeSchema, PostKeySchema, UlidSchema } from "./primitives";
import { RawPostSchema } from "./post";
import { SystemStateSchema } from "./state";
import { WarningReasonSchema } from "./enums";

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

export const ExtensionMessageSchema = z.discriminatedUnion("type", [
  GetGateStateMessageSchema,
  GateStateMessageSchema,
  PostSeenMessageSchema,
  InsertCommentMessageSchema,
  CommentConfirmedMessageSchema,
  WarningDetectedMessageSchema,
  SetEmergencyStopMessageSchema,
  EmergencyStopChangedMessageSchema,
  ResetCircuitBreakerMessageSchema,
  LeadsUpdatedMessageSchema,
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

export const ContentToBackgroundMessageSchema = z.discriminatedUnion("type", [
  GetGateStateMessageSchema,
  PostSeenMessageSchema,
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
]);
export type BackgroundToContentMessage = z.infer<
  typeof BackgroundToContentMessageSchema
>;

export const UiToBackgroundMessageSchema = z.discriminatedUnion("type", [
  SetEmergencyStopMessageSchema,
  ResetCircuitBreakerMessageSchema,
]);
export type UiToBackgroundMessage = z.infer<typeof UiToBackgroundMessageSchema>;

export const BackgroundToUiMessageSchema = z.discriminatedUnion("type", [
  LeadsUpdatedMessageSchema,
  EmergencyStopChangedMessageSchema,
]);
export type BackgroundToUiMessage = z.infer<typeof BackgroundToUiMessageSchema>;
