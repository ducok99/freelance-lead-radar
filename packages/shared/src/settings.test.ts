import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMITS,
  DEFAULT_SETTINGS,
  DEFAULT_TEAM_SKILLS,
  SCORE_THRESHOLDS,
  SettingsSchema,
} from "./index";
import { TEST_MEMBER_ULID } from "./test-fixtures";

describe("SettingsSchema", () => {
  it("tạo cấu hình mặc định an toàn", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      autoReply: { enabled: false },
      thresholds: SCORE_THRESHOLDS,
      limits: DEFAULT_LIMITS,
      retentionDays: 90,
      schemaVersion: 1,
    });
    expect(DEFAULT_SETTINGS.teamSkills).toEqual(DEFAULT_TEAM_SKILLS);
  });

  it("autoReply mặc định luôn false", () => {
    expect(SettingsSchema.parse({}).autoReply.enabled).toBe(false);
  });

  it("từ chối thay đổi ngưỡng cố định", () => {
    expect(
      SettingsSchema.safeParse({
        thresholds: { ignoreBelow: 70, reviewUpTo: 94, autoEligibleFrom: 95 },
      }).success,
    ).toBe(false);
  });

  it("từ chối giới hạn âm", () => {
    expect(
      SettingsSchema.safeParse({
        limits: { ...DEFAULT_LIMITS, maxCommentsPerDay: -1 },
      }).success,
    ).toBe(false);
  });

  it("chấp nhận cấu hình hợp lệ", () => {
    const result = SettingsSchema.safeParse({
      allowlist: [
        {
          groupId: "freelancer-vietnam",
          name: "Freelancer Việt Nam",
          url: "https://www.facebook.com/groups/freelancer-vietnam/",
          active: true,
        },
      ],
      members: [
        {
          id: TEST_MEMBER_ULID,
          name: "Thanh vien A",
          skills: ["video_editing"],
          active: true,
        },
      ],
      apiBaseUrl: "http://localhost:8787",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối groupId trùng trong allowlist", () => {
    const group = {
      groupId: "group-1",
      name: "Nhóm 1",
      url: "https://www.facebook.com/groups/group-1/",
      active: true,
    };
    expect(
      SettingsSchema.safeParse({
        allowlist: [group, { ...group, name: "Nhóm 2" }],
      }).success,
    ).toBe(false);
  });

  it("từ chối URL Facebook không phải URL nhóm", () => {
    expect(
      SettingsSchema.safeParse({
        allowlist: [
          {
            groupId: "group-1",
            name: "Nhóm 1",
            url: "https://www.facebook.com/profile.php?id=123",
            active: true,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("team token phải rỗng hoặc đủ mạnh", () => {
    expect(SettingsSchema.safeParse({ teamToken: "short-token" }).success).toBe(
      false,
    );
    expect(
      SettingsSchema.safeParse({ teamToken: " ".repeat(32) }).success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ teamToken: "a".repeat(32) }).success,
    ).toBe(true);
  });

  it("từ chối kỹ năng trùng", () => {
    expect(
      SettingsSchema.safeParse({
        teamSkills: ["video_editing", "video_editing"],
      }).success,
    ).toBe(false);
  });

  it("từ chối trường không khai báo", () => {
    expect(
      SettingsSchema.safeParse({ facebookPassword: "khong-duoc-phep" }).success,
    ).toBe(false);
  });
});
