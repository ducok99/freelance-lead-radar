import {
  CounterStateSchema,
  DEFAULT_LIMITS,
  DEFAULT_SETTINGS,
  SystemStateSchema,
  type FilterReason,
} from "@flr/shared";
import { describe, expect, it } from "vitest";
import { gate, hardFilters, type GateInput } from "./index";

const base: GateInput = {
  text: "Cần bạn edit video TikTok, budget rõ ràng.",
  teamSkills: ["video_editing"],
  groupAllowlisted: true,
  alreadyProcessed: false,
  systemState: SystemStateSchema.parse({}),
  counters: CounterStateSchema.parse({ date: "2026-07-20" }),
  limits: DEFAULT_SETTINGS.limits,
  now: "2026-07-20T12:00:00+07:00",
};

const positives: Array<[string, FilterReason, GateInput]> = [
  [
    "seeking 1",
    "poster_seeking_work",
    { ...base, text: "Em nhận job edit video freelance." },
  ],
  [
    "seeking 2",
    "poster_seeking_work",
    { ...base, text: "Tôi đang tìm việc dựng phim." },
  ],
  [
    "fulltime 1",
    "fulltime_recruitment",
    { ...base, text: "Tuyển nhân viên editor làm tại văn phòng." },
  ],
  [
    "fulltime 2",
    "fulltime_recruitment",
    { ...base, text: "Cần designer full-time, gửi CV phỏng vấn." },
  ],
  [
    "free trial 1",
    "free_trial_required",
    { ...base, text: "Cần bạn làm logo, test một mẫu miễn phí trước." },
  ],
  [
    "free trial 2",
    "free_trial_required",
    { ...base, text: "Tìm editor làm thử không lương một video." },
  ],
  [
    "no outsource 1",
    "no_outsourcing",
    { ...base, text: "Cần designer nhưng không nhận agency hoặc team." },
  ],
  [
    "no outsource 2",
    "no_outsourcing",
    { ...base, text: "Tuyển người làm web, chỉ nhận inhouse." },
  ],
  ["dedupe 1", "already_processed", { ...base, alreadyProcessed: true }],
  [
    "dedupe 2",
    "already_processed",
    { ...base, alreadyProcessed: true, text: "Tìm team dựng video." },
  ],
  [
    "skill 1",
    "no_team_skill_match",
    { ...base, text: "Cần người viết content SEO theo bài." },
  ],
  [
    "skill 2",
    "no_team_skill_match",
    { ...base, text: "Tìm bạn chạy marketing và ads." },
  ],
  [
    "allowlist 1",
    "group_not_allowlisted",
    { ...base, groupAllowlisted: false },
  ],
  [
    "allowlist 2",
    "group_not_allowlisted",
    { ...base, groupAllowlisted: false, text: "Tìm editor video." },
  ],
  [
    "warning 1",
    "facebook_warning_active",
    {
      ...base,
      systemState: {
        emergencyStop: false,
        circuitBreaker: {
          state: "tripped",
          reason: "captcha_detected",
          trippedAt: "2026-07-20T10:00:00+07:00",
        },
        schemaVersion: 1,
      },
    },
  ],
  [
    "warning 2",
    "facebook_warning_active",
    {
      ...base,
      systemState: {
        emergencyStop: true,
        circuitBreaker: {
          state: "tripped",
          reason: "checkpoint_detected",
          trippedAt: "2026-07-20T10:00:00+07:00",
        },
        schemaVersion: 1,
      },
    },
  ],
  [
    "daily 1",
    "daily_limit_reached",
    {
      ...base,
      counters: CounterStateSchema.parse({
        date: "2026-07-20",
        aiCalls: DEFAULT_LIMITS.maxAiCallsPerDay,
      }),
    },
  ],
  [
    "daily 2",
    "daily_limit_reached",
    {
      ...base,
      counters: CounterStateSchema.parse({ date: "2026-07-20", aiCalls: 999 }),
      limits: { ...DEFAULT_SETTINGS.limits, maxAiCallsPerDay: 999 },
    },
  ],
];

const negatives: Array<[string, FilterReason, GateInput]> = [
  ["hiring không seeking", "poster_seeking_work", base],
  [
    "freelance CTV",
    "poster_seeking_work",
    { ...base, text: "Tuyển CTV edit online, trả theo video." },
  ],
  ["freelance rõ", "fulltime_recruitment", base],
  [
    "CTV theo sản phẩm",
    "fulltime_recruitment",
    { ...base, text: "Tuyển CTV online, trả theo sản phẩm." },
  ],
  [
    "test có phí",
    "free_trial_required",
    { ...base, text: "Cần logo, bài test có trả phí đầy đủ." },
  ],
  ["không yêu cầu test", "free_trial_required", base],
  [
    "có nhận team",
    "no_outsourcing",
    { ...base, text: "Cần làm web, có nhận agency và team." },
  ],
  ["không nhắc outsource", "no_outsourcing", base],
  ["chưa xử lý", "already_processed", base],
  [
    "dedupe false 2",
    "already_processed",
    { ...base, alreadyProcessed: false, text: "Tìm team dựng video." },
  ],
  ["khớp video", "no_team_skill_match", base],
  [
    "không nhận diện field",
    "no_team_skill_match",
    { ...base, text: "Cần người xử lý hạng mục này, báo giá." },
  ],
  ["đúng allowlist", "group_not_allowlisted", base],
  [
    "allowlist true 2",
    "group_not_allowlisted",
    { ...base, groupAllowlisted: true, text: "Tìm editor video." },
  ],
  ["circuit armed", "facebook_warning_active", base],
  [
    "armed 2",
    "facebook_warning_active",
    { ...base, systemState: SystemStateSchema.parse({ emergencyStop: true }) },
  ],
  ["dưới limit", "daily_limit_reached", base],
  [
    "counter thấp 2",
    "daily_limit_reached",
    {
      ...base,
      counters: CounterStateSchema.parse({ date: "2026-07-20", aiCalls: 1 }),
    },
  ],
];

describe("hardFilters hai giai đoạn", () => {
  it.each(positives)("bắt positive %s", (_label, reason, input) => {
    expect(hardFilters({ ...input, phase: "pre_ai" }).reasons).toContain(
      reason,
    );
  });

  it.each(negatives)("không false-positive %s", (_label, reason, input) => {
    expect(hardFilters({ ...input, phase: "pre_ai" }).reasons).not.toContain(
      reason,
    );
  });

  it("post-AI áp classification và field", () => {
    expect(
      hardFilters({
        phase: "post_ai",
        text: "Bài mô tả chung.",
        classification: "seeking_work",
        extractionField: "other",
        teamSkills: ["video_editing"],
      }).reasons,
    ).toEqual(["poster_seeking_work", "no_team_skill_match"]);
  });

  it("gate từ chối nội dung quá ngắn", () => {
    expect(gate({ ...base, text: "Cần" })).toMatchObject({
      shouldCallAi: false,
      blockReasons: ["insufficient_text"],
    });
  });

  it("gate chặn spam trước AI", () => {
    expect(
      gate({
        ...base,
        text: "Việc nhẹ lương cao, chỉ cần điện thoại.",
      }),
    ).toMatchObject({
      shouldCallAi: false,
      heuristicClassification: "ad_or_spam",
    });
  });

  it("gate fail-safe khi Emergency Stop bật", () => {
    expect(
      gate({
        ...base,
        systemState: SystemStateSchema.parse({ emergencyStop: true }),
      }),
    ).toMatchObject({
      shouldCallAi: false,
      blockReasons: ["emergency_stop"],
    });
  });

  it("counter ngày cũ không gây daily-limit sai", () => {
    expect(
      gate({
        ...base,
        counters: CounterStateSchema.parse({
          date: "2026-07-19",
          aiCalls: DEFAULT_LIMITS.maxAiCallsPerDay,
        }),
      }).filterReasons,
    ).not.toContain("daily_limit_reached");
  });
});
