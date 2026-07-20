import type {
  Classification,
  CounterState,
  FilterReason,
  Limits,
  SkillField,
  SystemState,
} from "@flr/shared";
import { rollCounters } from "./counters";
import {
  classifyTextHeuristic,
  detectSkillFields,
  hasFreeTrialRequirement,
  hasNoOutsourcingRequirement,
  type HeuristicClassification,
} from "./lexicon";

export type GateBlockReason =
  FilterReason | "ad_or_spam" | "emergency_stop" | "insufficient_text";

export interface GateInput {
  text: string;
  teamSkills: readonly SkillField[];
  groupAllowlisted: boolean;
  alreadyProcessed: boolean;
  systemState: SystemState;
  counters: CounterState;
  limits: Limits;
  now: string | Date;
}

export interface GateDecision {
  shouldCallAi: boolean;
  heuristicClassification: HeuristicClassification;
  filterReasons: FilterReason[];
  blockReasons: GateBlockReason[];
  detectedFields: SkillField[];
}

export type HardFilterInput =
  | (GateInput & { phase: "pre_ai" })
  | {
      phase: "post_ai";
      text: string;
      classification: Classification;
      extractionField: SkillField;
      teamSkills: readonly SkillField[];
    };

export interface HardFilterResult {
  reasons: FilterReason[];
  classificationRejected: boolean;
}

const unique = <T extends string>(values: readonly T[]): T[] => [
  ...new Set(values),
];

const textFilterReasons = (text: string): FilterReason[] => {
  const classification = classifyTextHeuristic(text);
  const reasons: FilterReason[] = [];
  if (classification === "seeking_work") reasons.push("poster_seeking_work");
  if (classification === "fulltime_recruitment") {
    reasons.push("fulltime_recruitment");
  }
  if (hasFreeTrialRequirement(text)) reasons.push("free_trial_required");
  if (hasNoOutsourcingRequirement(text)) reasons.push("no_outsourcing");
  return reasons;
};

const hasTeamMatch = (
  detectedFields: readonly SkillField[],
  teamSkills: readonly SkillField[],
) =>
  detectedFields.length === 0 ||
  detectedFields.some((field) => teamSkills.includes(field));

export const hardFilters = (input: HardFilterInput): HardFilterResult => {
  const reasons = textFilterReasons(input.text);

  if (input.phase === "pre_ai") {
    if (!input.groupAllowlisted) reasons.push("group_not_allowlisted");
    if (input.alreadyProcessed) reasons.push("already_processed");
    if (input.systemState.circuitBreaker.state === "tripped") {
      reasons.push("facebook_warning_active");
    }
    const currentCounters = rollCounters(input.counters, input.now);
    if (currentCounters.aiCalls >= input.limits.maxAiCallsPerDay) {
      reasons.push("daily_limit_reached");
    }
    const detectedFields = detectSkillFields(input.text);
    if (!hasTeamMatch(detectedFields, input.teamSkills)) {
      reasons.push("no_team_skill_match");
    }
    return {
      reasons: unique(reasons),
      classificationRejected:
        classifyTextHeuristic(input.text) === "ad_or_spam",
    };
  }

  if (input.classification === "seeking_work") {
    reasons.push("poster_seeking_work");
  }
  if (input.classification === "fulltime_recruitment") {
    reasons.push("fulltime_recruitment");
  }
  if (!input.teamSkills.includes(input.extractionField)) {
    reasons.push("no_team_skill_match");
  }
  return {
    reasons: unique(reasons),
    classificationRejected: ["ad_or_spam", "other"].includes(
      input.classification,
    ),
  };
};

export const gate = (input: GateInput): GateDecision => {
  const heuristicClassification = classifyTextHeuristic(input.text);
  const detectedFields = detectSkillFields(input.text);
  const result = hardFilters({ ...input, phase: "pre_ai" });
  const blockReasons: GateBlockReason[] = [...result.reasons];

  if (input.systemState.emergencyStop) blockReasons.push("emergency_stop");
  if (input.text.trim().length < 10) blockReasons.push("insufficient_text");
  if (result.classificationRejected) blockReasons.push("ad_or_spam");

  return {
    shouldCallAi: blockReasons.length === 0,
    heuristicClassification,
    filterReasons: result.reasons,
    blockReasons: unique(blockReasons),
    detectedFields,
  };
};
