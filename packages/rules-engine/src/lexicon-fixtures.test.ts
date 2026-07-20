import { describe, expect, it } from "vitest";
import {
  CounterStateSchema,
  DEFAULT_SETTINGS,
  SystemStateSchema,
} from "@flr/shared";
import fixtures from "./fixtures/vietnamese-posts.json";
import { classifyTextHeuristic, gate } from "./index";
import type { HeuristicClassification } from "./lexicon";

const allTeamSkills = [
  "graphic_design",
  "video_editing",
  "web_dev",
  "architecture",
  "other",
] as const;

describe("40 fixture tiếng Việt gán nhãn tay", () => {
  it.each(fixtures)("$id → $expected", ({ text, expected }) => {
    expect(classifyTextHeuristic(text)).toBe(
      expected as HeuristicClassification,
    );
    const decision = gate({
      text,
      teamSkills: allTeamSkills,
      groupAllowlisted: true,
      alreadyProcessed: false,
      systemState: SystemStateSchema.parse({}),
      counters: CounterStateSchema.parse({ date: "2026-07-20" }),
      limits: DEFAULT_SETTINGS.limits,
      now: "2026-07-20T12:00:00+07:00",
    });
    expect(decision.shouldCallAi).toBe(expected === "hiring_freelancer");
  });

  it("độ chính xác fixture đạt ít nhất 90%", () => {
    const correct = fixtures.filter(
      ({ text, expected }) => classifyTextHeuristic(text) === expected,
    ).length;
    expect(correct / fixtures.length).toBeGreaterThanOrEqual(0.9);
  });
});
