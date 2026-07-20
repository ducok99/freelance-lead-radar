import type {
  ClassifyRequest,
  ClassifyResponse,
  DraftRequest,
} from "@flr/shared";
import type { ApiBindings } from "./types";

export const TEST_NOW = "2026-07-20T14:00:00.000Z";
export const TEST_TOKEN = "local-team-token-for-tests";
export const TEST_ORIGIN = "chrome-extension://test-extension-id";

export const testBindings: ApiBindings = {
  TEAM_TOKEN: TEST_TOKEN,
  EXTENSION_ORIGIN: TEST_ORIGIN,
  AI_PROVIDER: "mock",
};

export const classifyRequest: ClassifyRequest = {
  posts: [
    {
      postKey: "1234567890:9876543210",
      text: "Cần bạn edit 10 video TikTok, có budget theo video.",
      anonymousPoster: false,
      truncated: false,
      postedAtText: "2 giờ",
    },
  ],
  teamSkills: ["video_editing"],
  schemaVersion: 1,
};

export const classifyResponse: ClassifyResponse = {
  results: [
    {
      postKey: "1234567890:9876543210",
      classification: "hiring_freelancer",
      confidence: 0.93,
      scoreBreakdown: {
        intent: 38,
        budget: 8,
        fieldMatch: 15,
        urgency: 0,
        contact: 6,
        quality: 8,
        adjustments: [],
      },
      extraction: {
        jobSummary: "Edit 10 video TikTok",
        field: "video_editing",
        tools: [],
        contacts: [],
      },
    },
  ],
  schemaVersion: 1,
};

export const draftRequest: DraftRequest = {
  postKey: "1234567890:9876543210",
  postText: "Cần bạn edit 10 video TikTok, có budget theo video.",
  extraction: {
    jobSummary: "Edit 10 video TikTok",
    field: "video_editing",
    tools: [],
    contacts: [],
  },
  score: 88,
  teamProfile: "Team chuyên dựng video ngắn bằng Premiere và CapCut.",
  schemaVersion: 1,
};

export const draftProviderOutput = {
  draft: {
    aiText:
      "Mình đã đọc nhu cầu edit 10 video TikTok của bạn. Team mình chuyên dựng video ngắn; bạn ib mình xem portfolio nhé.",
    rationale: "Bám đúng nhu cầu, không bịa thông tin và có CTA nhẹ.",
  },
};
