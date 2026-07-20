import { z } from "zod";

export const ClassificationSchema = z.enum([
  "hiring_freelancer",
  "seeking_work",
  "fulltime_recruitment",
  "ad_or_spam",
  "other",
]);
export type Classification = z.infer<typeof ClassificationSchema>;

export const SkillFieldSchema = z.enum([
  "graphic_design",
  "video_editing",
  "web_dev",
  "architecture",
  "other",
]);
export type SkillField = z.infer<typeof SkillFieldSchema>;

export const FilterReasonSchema = z.enum([
  "poster_seeking_work",
  "fulltime_recruitment",
  "free_trial_required",
  "no_outsourcing",
  "already_processed",
  "no_team_skill_match",
  "group_not_allowlisted",
  "facebook_warning_active",
  "daily_limit_reached",
  "ad_or_spam",
  "classification_rejected",
  "insufficient_text",
]);
export type FilterReason = z.infer<typeof FilterReasonSchema>;

export const LeadStatusSchema = z.enum([
  "detected",
  "filtered_out",
  "below_threshold",
  "needs_review",
  "skipped",
  "approved",
  "comment_inserted",
  "commented",
  "assigned",
  "won",
  "lost",
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const AuditActionSchema = z.enum([
  "post_detected",
  "filtered",
  "ai_classified",
  "ai_error",
  "retry_requested",
  "pipeline_resumed",
  "draft_created",
  "draft_edited",
  "approved",
  "comment_inserted",
  "comment_confirmed",
  "skipped",
  "labeled",
  "assigned",
  "outcome_set",
  "emergency_stop_on",
  "emergency_stop_off",
  "circuit_tripped",
  "circuit_reset",
  "settings_changed",
  "data_purged",
  "data_exported",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const ContactChannelSchema = z.enum([
  "phone",
  "zalo",
  "email",
  "messenger_hint",
]);
export type ContactChannel = z.infer<typeof ContactChannelSchema>;

export const BudgetPeriodSchema = z.enum(["unit", "project", "month"]);
export type BudgetPeriod = z.infer<typeof BudgetPeriodSchema>;

export const LeadLabelSchema = z.enum(["correct", "incorrect"]);
export type LeadLabel = z.infer<typeof LeadLabelSchema>;

export const LeadOutcomeSchema = z.enum(["won", "lost"]);
export type LeadOutcome = z.infer<typeof LeadOutcomeSchema>;

export const WarningReasonSchema = z.enum([
  "checkpoint_detected",
  "captcha_detected",
  "temporarily_blocked",
  "login_redirect",
  "facebook_warning",
  "unknown_warning",
]);
export type WarningReason = z.infer<typeof WarningReasonSchema>;
