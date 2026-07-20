import type { z } from "zod";
import {
  AuditEventSchema,
  ExtractionSchema,
  LeadSchema,
  RawPostSchema,
  ScoreBreakdownSchema,
} from "./index";

export const TEST_ULID = "01J2ZK8Q9M3T5V7X9A1C3E5G7J";
export const TEST_MEMBER_ULID = "01J2ZK8Q9M3T5V7X9A1C3E5G7K";
export const TEST_AUDIT_ULID = "01J2ZK8Q9M3T5V7X9A1C3E5G7M";
export const TEST_NOW = "2026-07-18T09:12:20+07:00";

export const validRawPost: z.input<typeof RawPostSchema> = {
  postKey: "1234567890:9876543210",
  groupId: "1234567890",
  permalink: "https://www.facebook.com/groups/1234567890/posts/9876543210/",
  authorName: "Nguyen V.",
  anonymousPoster: false,
  text: "Cần 1 bạn edit 10 video TikTok, budget 300k/video.",
  truncated: false,
  postedAtText: "2 giờ",
  seenAt: TEST_NOW,
};

export const validExtraction: z.input<typeof ExtractionSchema> = {
  jobSummary: "Edit 10 video TikTok từ footage có sẵn",
  field: "video_editing",
  budget: {
    raw: "300k/video",
    minVnd: 300_000,
    maxVnd: 300_000,
    per: "unit",
  },
  deadline: { raw: "trước CN", date: "2026-07-19" },
  tools: ["CapCut"],
  contacts: [{ channel: "zalo", value: "09xx xxx xxx" }],
};

export const validScoreBreakdown: z.input<typeof ScoreBreakdownSchema> = {
  intent: 38,
  budget: 15,
  fieldMatch: 15,
  urgency: 10,
  contact: 10,
  quality: 8,
  adjustments: [{ reason: "repost_suspect", delta: -8 }],
};

export const validLead: z.input<typeof LeadSchema> = {
  id: TEST_ULID,
  post: validRawPost,
  classification: "hiring_freelancer",
  confidence: 0.93,
  score: 88,
  scoreBreakdown: validScoreBreakdown,
  autoEligible: false,
  extraction: validExtraction,
  status: "needs_review",
  filterReasons: [],
  draft: {
    aiText: "Chào bạn, bên mình có thể nhận hạng mục này.",
    rationale: "Đúng chuyên môn và có ngân sách rõ.",
    createdAt: TEST_NOW,
  },
  label: null,
  assignedTo: null,
  outcome: null,
  schemaVersion: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

export const validAuditEvent: z.input<typeof AuditEventSchema> = {
  id: TEST_AUDIT_ULID,
  ts: TEST_NOW,
  actor: "system",
  action: "ai_classified",
  leadId: TEST_ULID,
  postKey: "1234567890:9876543210",
  detail: { score: 88, classification: "hiring_freelancer" },
  schemaVersion: 1,
};
