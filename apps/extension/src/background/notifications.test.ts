import {
  DEFAULT_SETTINGS,
  LeadSchema,
  SCHEMA_VERSION,
  type Lead,
  type LeadStatus,
  type Settings,
} from "@flr/shared";
import { describe, expect, it, vi } from "vitest";
import { createUlid } from "../lib/ulid";
import {
  LEAD_NOTIFICATION_ID_PREFIX,
  MAX_INDIVIDUAL_NOTIFICATIONS,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  SUMMARY_NOTIFICATION_ID,
  buildLeadNotifications,
  createLeadNotifier,
  notificationTarget,
  selectNotifiableLeads,
} from "./notifications";

const NOW = "2026-07-20T08:00:00.000Z";

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  allowlist: [
    {
      groupId: "allowed",
      name: "Freelancer Việt Nam",
      url: "https://www.facebook.com/groups/allowed",
      active: true,
    },
  ],
};

let idCounter = 1;
const makeLead = (
  overrides: {
    status?: LeadStatus;
    score?: number;
    jobSummary?: string;
    groupId?: string;
    postId?: string;
  } = {},
): Lead => {
  const {
    status = "needs_review",
    score = 88,
    jobSummary = "Edit 10 video TikTok từ footage có sẵn",
    groupId = "allowed",
    postId = String(1000 + idCounter),
  } = overrides;
  idCounter += 1;
  return LeadSchema.parse({
    id: createUlid(
      Date.parse(NOW),
      new Uint8Array(16).fill((idCounter % 31) + 1),
    ),
    post: {
      postKey: `${groupId}:${postId}`,
      groupId,
      permalink: `https://www.facebook.com/groups/${groupId}/posts/${postId}/`,
      text: jobSummary,
      anonymousPoster: false,
      truncated: false,
      seenAt: NOW,
    },
    classification: "hiring_freelancer",
    confidence: 0.9,
    score,
    scoreBreakdown: {
      intent: 38,
      budget: 15,
      fieldMatch: 15,
      urgency: 8,
      contact: 7,
      quality: 5,
      adjustments: [],
    },
    autoEligible: false,
    extraction: {
      jobSummary,
      field: "video_editing",
      tools: [],
      contacts: [],
    },
    status,
    // LeadSchema yêu cầu lead filtered_out phải có ít nhất một filterReason.
    filterReasons: status === "filtered_out" ? ["poster_seeking_work"] : [],
    label: null,
    assignedTo: null,
    outcome: null,
    schemaVersion: SCHEMA_VERSION,
    createdAt: NOW,
    updatedAt: NOW,
  });
};

describe("P6.1 buildLeadNotifications", () => {
  it("một lead needs_review → một thông báo có điểm, tên nhóm và id theo postKey", () => {
    const lead = makeLead({ score: 91 });
    const [notification, ...rest] = buildLeadNotifications([lead], settings);
    expect(rest).toHaveLength(0);
    expect(notification?.id).toBe(
      `${LEAD_NOTIFICATION_ID_PREFIX}${lead.post.postKey}`,
    );
    expect(notification?.title).toBe("Lead 91 điểm — Freelancer Việt Nam");
    expect(notification?.message).toBe(lead.extraction.jobSummary);
  });

  it("chỉ thông báo lead needs_review, bỏ qua trạng thái khác", () => {
    const leads = [
      makeLead({ status: "needs_review" }),
      makeLead({ status: "below_threshold", score: 40 }),
      makeLead({ status: "filtered_out", score: 0 }),
    ];
    expect(selectNotifiableLeads(leads)).toHaveLength(1);
    expect(buildLeadNotifications(leads, settings)).toHaveLength(1);
    expect(buildLeadNotifications([leads[1]!, leads[2]!], settings)).toEqual(
      [],
    );
  });

  it("cắt nội dung dài theo giới hạn và thêm dấu ba chấm", () => {
    const long = "Cần thuê ".repeat(40).trim();
    const [notification] = buildLeadNotifications(
      [makeLead({ jobSummary: long })],
      settings,
    );
    expect(notification?.message.length).toBeLessThanOrEqual(
      NOTIFICATION_MESSAGE_MAX_LENGTH,
    );
    expect(notification?.message.endsWith("…")).toBe(true);
  });

  it("nhóm ngoài allowlist hiện tên dự phòng thay vì lộ trống", () => {
    const [notification] = buildLeadNotifications(
      [makeLead({ groupId: "khac" })],
      settings,
    );
    expect(notification?.title).toContain("nhóm Facebook");
  });

  it("nhiều hơn giới hạn → gộp một thông báo tổng", () => {
    const leads = Array.from(
      { length: MAX_INDIVIDUAL_NOTIFICATIONS + 1 },
      (_, index) => makeLead({ postId: `20${index}` }),
    );
    const notifications = buildLeadNotifications(leads, settings);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.id).toBe(SUMMARY_NOTIFICATION_ID);
    expect(notifications[0]?.title).toBe(
      `${MAX_INDIVIDUAL_NOTIFICATIONS + 1} lead mới chờ duyệt`,
    );
  });
});

describe("P6.1 notificationTarget", () => {
  it("id lead → postKey; id tổng → summary; id lạ → null", () => {
    expect(
      notificationTarget(`${LEAD_NOTIFICATION_ID_PREFIX}allowed:123`),
    ).toEqual({ kind: "lead", postKey: "allowed:123" });
    expect(notificationTarget(SUMMARY_NOTIFICATION_ID)).toEqual({
      kind: "summary",
    });
    expect(notificationTarget("thong-bao-cua-extension-khac")).toBeNull();
    expect(notificationTarget(LEAD_NOTIFICATION_ID_PREFIX)).toBeNull();
  });
});

describe("P6.1 createLeadNotifier", () => {
  it("tắt trong Settings → không hiện gì (đọc settings mỗi lần gọi)", async () => {
    const show = vi.fn(() => Promise.resolve());
    let enabled = true;
    const notify = createLeadNotifier({
      getSettings: () =>
        Promise.resolve({
          ...settings,
          notifications: { enabled },
        }),
      show,
    });

    await notify([makeLead()]);
    expect(show).toHaveBeenCalledTimes(1);

    enabled = false;
    await notify([makeLead()]);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("bật → hiện đúng một thông báo cho mỗi lead trong batch nhỏ", async () => {
    const show = vi.fn(() => Promise.resolve());
    const notify = createLeadNotifier({
      getSettings: () => Promise.resolve(settings),
      show,
    });
    await notify([makeLead(), makeLead()]);
    expect(show).toHaveBeenCalledTimes(2);
  });
});
