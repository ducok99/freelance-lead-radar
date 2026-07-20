import { z } from "zod";
import {
  DEFAULT_LIMITS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_TEAM_SKILLS,
  SCHEMA_VERSION,
  SCORE_THRESHOLDS,
} from "./constants";
import { SkillFieldSchema } from "./enums";
import {
  ApiBaseUrlSchema,
  FacebookGroupUrlSchema,
  GroupIdSchema,
  SchemaVersionSchema,
  UlidSchema,
} from "./primitives";

const uniqueValues = (values: readonly string[]) =>
  new Set(values).size === values.length;

export const GroupRefSchema = z
  .object({
    groupId: GroupIdSchema,
    name: z.string().trim().min(1).max(160),
    url: FacebookGroupUrlSchema,
    active: z.boolean().default(true),
  })
  .strict();
export type GroupRef = z.infer<typeof GroupRefSchema>;

export const TeamMemberSchema = z
  .object({
    id: UlidSchema,
    name: z.string().trim().min(1).max(120),
    skills: z
      .array(SkillFieldSchema)
      .min(1)
      .refine(uniqueValues, "Kỹ năng thành viên không được trùng"),
    contact: z.string().trim().min(1).max(200).optional(),
    active: z.boolean().default(true),
  })
  .strict();
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const ThresholdsSchema = z
  .object({
    ignoreBelow: z
      .literal(SCORE_THRESHOLDS.ignoreBelow)
      .default(SCORE_THRESHOLDS.ignoreBelow),
    reviewUpTo: z
      .literal(SCORE_THRESHOLDS.reviewUpTo)
      .default(SCORE_THRESHOLDS.reviewUpTo),
    autoEligibleFrom: z
      .literal(SCORE_THRESHOLDS.autoEligibleFrom)
      .default(SCORE_THRESHOLDS.autoEligibleFrom),
  })
  .strict();
export type Thresholds = z.infer<typeof ThresholdsSchema>;

export const LimitsSchema = z
  .object({
    maxCommentsPerDay: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(DEFAULT_LIMITS.maxCommentsPerDay),
    minCommentIntervalMin: z
      .number()
      .int()
      .min(1)
      .max(1_440)
      .default(DEFAULT_LIMITS.minCommentIntervalMin),
    maxAiCallsPerDay: z
      .number()
      .int()
      .min(1)
      .max(10_000)
      .default(DEFAULT_LIMITS.maxAiCallsPerDay),
  })
  .strict();
export type Limits = z.infer<typeof LimitsSchema>;

export const AutoReplySettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
  })
  .strict();
export type AutoReplySettings = z.infer<typeof AutoReplySettingsSchema>;

/**
 * P6.1 — thông báo desktop khi có lead mới vào hàng đợi duyệt (DUC yêu cầu &
 * duyệt 2026-07-20). Khác với autoReply, mặc định BẬT: thông báo chỉ là hiển
 * thị cục bộ trên máy người dùng, không tương tác gì với Facebook.
 */
export const NotificationSettingsSchema = z
  .object({
    enabled: z.boolean().default(DEFAULT_NOTIFICATIONS.enabled),
  })
  .strict();
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

export const SettingsSchema = z
  .object({
    allowlist: z.array(GroupRefSchema).default([]),
    teamSkills: z
      .array(SkillFieldSchema)
      .min(1)
      .refine(uniqueValues, "Kỹ năng team không được trùng")
      .default(() => [...DEFAULT_TEAM_SKILLS]),
    teamProfile: z.string().trim().max(1_000).default(""),
    members: z.array(TeamMemberSchema).default([]),
    thresholds: ThresholdsSchema.default(SCORE_THRESHOLDS),
    limits: LimitsSchema.default(DEFAULT_LIMITS),
    autoReply: AutoReplySettingsSchema.default({ enabled: false }),
    notifications: NotificationSettingsSchema.default(DEFAULT_NOTIFICATIONS),
    retentionDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(DEFAULT_RETENTION_DAYS),
    apiBaseUrl: ApiBaseUrlSchema.default(""),
    teamToken: z
      .union([z.literal(""), z.string().trim().min(32).max(512)])
      .default(""),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict()
  .superRefine((settings, context) => {
    if (!uniqueValues(settings.allowlist.map((group) => group.groupId))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowlist"],
        message: "groupId trong allowlist không được trùng",
      });
    }
    if (!uniqueValues(settings.members.map((member) => member.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["members"],
        message: "ID thành viên không được trùng",
      });
    }
  });
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
