import { z } from "zod";
import { SCHEMA_VERSION } from "./constants";
import { WarningReasonSchema } from "./enums";
import {
  DateOnlySchema,
  IsoDateTimeSchema,
  NonNegativeIntegerSchema,
  PostKeySchema,
  SchemaVersionSchema,
  UlidSchema,
} from "./primitives";

export const CounterStateSchema = z
  .object({
    date: DateOnlySchema,
    aiCalls: NonNegativeIntegerSchema.default(0),
    commentsInserted: NonNegativeIntegerSchema.default(0),
    lastCommentAt: IsoDateTimeSchema.optional(),
    extractionAttempts: NonNegativeIntegerSchema.default(0),
    extractionFailures: NonNegativeIntegerSchema.default(0),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.extractionFailures > state.extractionAttempts) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extractionFailures"],
        message: "extractionFailures không được lớn hơn extractionAttempts",
      });
    }
  });
export type CounterState = z.infer<typeof CounterStateSchema>;

export const CircuitBreakerSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("armed") }).strict(),
  z
    .object({
      state: z.literal("tripped"),
      reason: WarningReasonSchema,
      trippedAt: IsoDateTimeSchema,
    })
    .strict(),
]);
export type CircuitBreaker = z.infer<typeof CircuitBreakerSchema>;

export const SystemStateSchema = z
  .object({
    emergencyStop: z.boolean().default(false),
    circuitBreaker: CircuitBreakerSchema.default({ state: "armed" }),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict();
export type SystemState = z.infer<typeof SystemStateSchema>;

export const DedupeEntrySchema = z
  .object({
    leadId: UlidSchema.optional(),
    decidedAt: IsoDateTimeSchema,
    terminal: z.boolean(),
  })
  .strict();
export type DedupeEntry = z.infer<typeof DedupeEntrySchema>;

export const DedupeIndexSchema = z.record(PostKeySchema, DedupeEntrySchema);
export type DedupeIndex = z.infer<typeof DedupeIndexSchema>;
