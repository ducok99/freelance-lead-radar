import {
  AUTO_REPLY_MIN_CONFIDENCE,
  SCORE_THRESHOLDS,
  type Classification,
  type FilterReason,
  type ScoreBreakdown,
} from "@flr/shared";

export interface AggregateScoreResult {
  rawScore: number;
  score: number;
  confidenceCapped: boolean;
}

const clampScore = (value: number) => Math.min(100, Math.max(0, value));

export const aggregateScore = (
  breakdown: ScoreBreakdown,
  confidence: number,
): AggregateScoreResult => {
  const componentTotal =
    breakdown.intent +
    breakdown.budget +
    breakdown.fieldMatch +
    breakdown.urgency +
    breakdown.contact +
    breakdown.quality;
  const adjustmentTotal = breakdown.adjustments.reduce(
    (sum, adjustment) => sum + adjustment.delta,
    0,
  );
  const rawScore = clampScore(componentTotal + adjustmentTotal);
  const confidenceCapped =
    confidence < AUTO_REPLY_MIN_CONFIDENCE &&
    rawScore > SCORE_THRESHOLDS.reviewUpTo;
  return {
    rawScore,
    score: confidenceCapped ? SCORE_THRESHOLDS.reviewUpTo : rawScore,
    confidenceCapped,
  };
};

export const isAutoEligible = (input: {
  score: number;
  confidence: number;
  classification: Classification;
  filterReasons: readonly FilterReason[];
}): boolean =>
  input.score >= SCORE_THRESHOLDS.autoEligibleFrom &&
  input.confidence >= AUTO_REPLY_MIN_CONFIDENCE &&
  input.classification === "hiring_freelancer" &&
  input.filterReasons.length === 0;
