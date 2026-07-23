// P6.14 — JSON Schema cho Workers AI JSON Mode.
//
// Cloudflare Workers AI hỗ trợ `response_format: { type: "json_schema", ... }`
// để ÉP model trả về đúng khung JSON (không Markdown, không văn bản thừa,
// đúng tên trường + enum). Đây là cách sửa gốc cho lỗi model free 8B hay trả
// JSON sai định dạng khiến /v1/classify trả 502 "AI tạm thời không khả dụng".
//
// LƯU Ý ĐỒNG BỘ: các schema dưới đây PHẢI khớp với Zod schema nguồn chân lý
// trong @flr/shared (ClassifyResponseSchema, ClassifyResultSchema,
// ScoreBreakdownSchema, ExtractionSchema, DraftResponseSchema, ReplyDraftSchema).
// Zod vẫn là cửa kiểm tra cuối (provider-output.ts) — JSON Mode chỉ giúp model
// dễ trả đúng, KHÔNG thay thế Zod. Nếu đổi Zod thì cập nhật file này cùng lúc.
//
// additionalProperties:false ở mỗi cấp để khớp Zod `.strict()` (không cho model
// thêm trường lạ). Các trường tuỳ chọn (budget/deadline/tools/contacts/
// adjustments) được liệt kê nhưng KHÔNG bắt buộc, đúng như Zod.

const CLASSIFICATION_ENUM = [
  "hiring_freelancer",
  "seeking_work",
  "fulltime_recruitment",
  "ad_or_spam",
  "other",
] as const;

const FIELD_ENUM = [
  "graphic_design",
  "video_editing",
  "web_dev",
  "architecture",
  "other",
] as const;

const CONTACT_CHANNEL_ENUM = [
  "phone",
  "zalo",
  "email",
  "messenger_hint",
] as const;

const BUDGET_PER_ENUM = ["unit", "project", "month", null] as const;

const budgetSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    raw: { type: "string" },
    minVnd: { type: "number" },
    maxVnd: { type: "number" },
    per: { type: ["string", "null"], enum: BUDGET_PER_ENUM },
  },
  required: ["raw"],
} as const;

const deadlineSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    raw: { type: "string" },
    date: { type: "string" },
  },
  required: ["raw"],
} as const;

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    jobSummary: { type: "string" },
    field: { type: "string", enum: FIELD_ENUM },
    budget: budgetSchema,
    deadline: deadlineSchema,
    tools: { type: "array", items: { type: "string" } },
    contacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          channel: { type: "string", enum: CONTACT_CHANNEL_ENUM },
          value: { type: "string" },
        },
        required: ["channel", "value"],
      },
    },
  },
  required: ["jobSummary", "field"],
} as const;

const scoreBreakdownSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "number" },
    budget: { type: "number" },
    fieldMatch: { type: "number" },
    urgency: { type: "number" },
    contact: { type: "number" },
    quality: { type: "number" },
    adjustments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: { type: "string" },
          delta: { type: "number" },
        },
        required: ["reason", "delta"],
      },
    },
  },
  required: ["intent", "budget", "fieldMatch", "urgency", "contact", "quality"],
} as const;

/** Khung JSON bắt buộc cho phản hồi /v1/classify. */
export const CLASSIFY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          postKey: { type: "string" },
          classification: { type: "string", enum: CLASSIFICATION_ENUM },
          confidence: { type: "number" },
          scoreBreakdown: scoreBreakdownSchema,
          extraction: extractionSchema,
        },
        required: [
          "postKey",
          "classification",
          "confidence",
          "scoreBreakdown",
          "extraction",
        ],
      },
    },
  },
  required: ["results"],
} as const;

/** Khung JSON bắt buộc cho phản hồi /v1/draft (đúng hai trường AI). */
export const DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    draft: {
      type: "object",
      additionalProperties: false,
      properties: {
        aiText: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["aiText", "rationale"],
    },
  },
  required: ["draft"],
} as const;
