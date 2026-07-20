import { z } from "zod";
import { API_MAX_BATCH_SIZE, SCHEMA_VERSION } from "./constants";
import { ClassificationSchema, SkillFieldSchema } from "./enums";
import { ExtractionSchema } from "./extraction";
import { ReplyDraftSchema, ScoreBreakdownSchema } from "./lead";
import {
  ConfidenceSchema,
  PostKeySchema,
  SchemaVersionSchema,
  ScoreSchema,
} from "./primitives";
import { PostInputSchema } from "./post";

const uniqueValues = (values: readonly string[]) =>
  new Set(values).size === values.length;

export const HealthResponseSchema = z
  .object({
    ok: z.literal(true),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict();
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ClassifyRequestSchema = z
  .object({
    posts: z.array(PostInputSchema).min(1).max(API_MAX_BATCH_SIZE),
    teamSkills: z.array(SkillFieldSchema).min(1).max(5),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict()
  .superRefine((request, context) => {
    if (!uniqueValues(request.posts.map((post) => post.postKey))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["posts"],
        message: "Mỗi postKey chỉ được xuất hiện một lần trong batch",
      });
    }
    if (!uniqueValues(request.teamSkills)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamSkills"],
        message: "Kỹ năng team không được trùng",
      });
    }
  });
export type ClassifyRequest = z.infer<typeof ClassifyRequestSchema>;

export const ClassifyResultSchema = z
  .object({
    postKey: PostKeySchema,
    classification: ClassificationSchema,
    confidence: ConfidenceSchema,
    scoreBreakdown: ScoreBreakdownSchema,
    extraction: ExtractionSchema,
  })
  .strict();
export type ClassifyResult = z.infer<typeof ClassifyResultSchema>;

export const ClassifyResponseSchema = z
  .object({
    results: z.array(ClassifyResultSchema).min(1).max(API_MAX_BATCH_SIZE),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict()
  .superRefine((response, context) => {
    if (!uniqueValues(response.results.map((result) => result.postKey))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["results"],
        message: "Mỗi postKey chỉ được xuất hiện một lần trong kết quả",
      });
    }
  });
export type ClassifyResponse = z.infer<typeof ClassifyResponseSchema>;

export const DraftRequestSchema = z
  .object({
    postKey: PostKeySchema,
    postText: z.string().max(50_000),
    extraction: ExtractionSchema,
    score: ScoreSchema,
    teamProfile: z.string().trim().min(1).max(1_000),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict();
export type DraftRequest = z.infer<typeof DraftRequestSchema>;

export const DraftResponseSchema = z
  .object({
    draft: ReplyDraftSchema,
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict();
export type DraftResponse = z.infer<typeof DraftResponseSchema>;

export const ApiErrorCodeSchema = z.enum([
  "invalid_request",
  "unauthorized",
  "rate_limited",
  "payload_too_large",
  "ai_unavailable",
  "invalid_ai_response",
  "internal_error",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().trim().min(1).max(500),
        retryable: z.boolean(),
      })
      .strict(),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict();
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
