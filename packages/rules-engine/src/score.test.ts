import type { ScoreBreakdown } from "@flr/shared";
import { describe, expect, it } from "vitest";
import { aggregateScore, isAutoEligible } from "./index";

const breakdown: ScoreBreakdown = {
  intent: 40,
  budget: 15,
  fieldMatch: 15,
  urgency: 10,
  contact: 10,
  quality: 10,
  adjustments: [],
};

describe("aggregateScore deterministic", () => {
  const cases: Array<[string, ScoreBreakdown, number, number]> = [
    ["tổng chuẩn", breakdown, 0.9, 100],
    [
      "điều chỉnh âm",
      { ...breakdown, adjustments: [{ reason: "spam mềm", delta: -20 }] },
      0.9,
      80,
    ],
    [
      "không âm",
      {
        ...breakdown,
        intent: 0,
        budget: 0,
        fieldMatch: 0,
        urgency: 0,
        contact: 0,
        quality: 0,
        adjustments: [{ reason: "phạt", delta: -20 }],
      },
      0.9,
      0,
    ],
    [
      "không quá 100",
      { ...breakdown, adjustments: [{ reason: "thưởng", delta: 20 }] },
      0.9,
      100,
    ],
    ["confidence 0.84 cap 94", breakdown, 0.84, 94],
    ["confidence 0.85 không cap", breakdown, 0.85, 100],
  ];

  it.each(cases)("%s", (_label, input, confidence, expected) => {
    expect(aggregateScore(input, confidence).score).toBe(expected);
  });

  it("báo rõ khi confidence cap", () => {
    expect(aggregateScore(breakdown, 0.84)).toEqual({
      rawScore: 100,
      score: 94,
      confidenceCapped: true,
    });
  });
});

describe("Auto Eligible chỉ là cờ", () => {
  const eligible = {
    score: 95,
    confidence: 0.9,
    classification: "hiring_freelancer" as const,
    filterReasons: [],
  };

  it("đúng đủ điều kiện", () => expect(isAutoEligible(eligible)).toBe(true));
  it("sai khi score 94", () =>
    expect(isAutoEligible({ ...eligible, score: 94 })).toBe(false));
  it("sai khi confidence thấp", () =>
    expect(isAutoEligible({ ...eligible, confidence: 0.84 })).toBe(false));
  it("sai khi classification khác", () =>
    expect(isAutoEligible({ ...eligible, classification: "other" })).toBe(
      false,
    ));
  it("sai khi có filter", () =>
    expect(
      isAutoEligible({ ...eligible, filterReasons: ["no_team_skill_match"] }),
    ).toBe(false));
});
