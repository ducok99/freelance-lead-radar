import {
  IsoDateTimeSchema,
  LeadSchema,
  type AuditAction,
  type FilterReason,
  type Lead,
  type LeadStatus,
} from "@flr/shared";

const ALLOWED_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> =
  {
    detected: ["filtered_out", "below_threshold", "needs_review"],
    filtered_out: [],
    below_threshold: [],
    needs_review: ["skipped", "approved"],
    skipped: [],
    approved: ["comment_inserted", "assigned"],
    comment_inserted: ["commented"],
    commented: ["assigned"],
    assigned: ["won", "lost"],
    won: [],
    lost: [],
  };

const ACTION_BY_STATUS: Readonly<Partial<Record<LeadStatus, AuditAction>>> = {
  filtered_out: "filtered",
  below_threshold: "ai_classified",
  needs_review: "ai_classified",
  skipped: "skipped",
  approved: "approved",
  comment_inserted: "comment_inserted",
  commented: "comment_confirmed",
  assigned: "assigned",
  won: "outcome_set",
  lost: "outcome_set",
};

export interface TransitionMetadata {
  at: string;
  filterReasons?: readonly FilterReason[];
  finalComment?: string;
  assignedTo?: string;
}

export interface TransitionAuditDraft {
  action: AuditAction;
  leadId: string;
  postKey: string;
  ts: string;
  detail: { from: LeadStatus; to: LeadStatus };
}

export interface TransitionSuccess {
  ok: true;
  lead: Lead;
  audit: TransitionAuditDraft;
}

export interface TransitionFailure {
  ok: false;
  error: InvalidLeadTransitionError;
  auditDetail: { from: LeadStatus; to: LeadStatus; code: "invalid_transition" };
}

export class InvalidLeadTransitionError extends Error {
  constructor(
    readonly from: LeadStatus,
    readonly to: LeadStatus,
    message = `Transition không hợp lệ: ${from} -> ${to}`,
  ) {
    super(message);
    this.name = "InvalidLeadTransitionError";
  }
}

export const canTransition = (from: LeadStatus, to: LeadStatus): boolean =>
  (ALLOWED_TRANSITIONS[from] ?? []).includes(to);

export const transitionLead = (
  lead: Lead,
  to: LeadStatus,
  metadata: TransitionMetadata,
): TransitionSuccess => {
  if (!canTransition(lead.status, to)) {
    throw new InvalidLeadTransitionError(lead.status, to);
  }
  if (!IsoDateTimeSchema.safeParse(metadata.at).success) {
    throw new InvalidLeadTransitionError(
      lead.status,
      to,
      "Thời gian transition không hợp lệ",
    );
  }
  if (Date.parse(metadata.at) < Date.parse(lead.updatedAt)) {
    throw new InvalidLeadTransitionError(
      lead.status,
      to,
      "Thời gian transition không được sớm hơn updatedAt",
    );
  }

  const from = lead.status;
  const candidate: Record<string, unknown> = {
    ...lead,
    status: to,
    updatedAt: metadata.at,
  };

  if (to === "filtered_out") {
    candidate.filterReasons = metadata.filterReasons ?? [];
  }
  if (to === "skipped") candidate.skippedAt = metadata.at;
  if (to === "approved") candidate.approvedAt = metadata.at;
  if (to === "comment_inserted") {
    candidate.finalComment = metadata.finalComment;
  }
  if (to === "commented") candidate.commentedAt = metadata.at;
  if (to === "assigned") candidate.assignedTo = metadata.assignedTo;
  if (to === "won" || to === "lost") candidate.outcome = to;

  const result = LeadSchema.safeParse(candidate);
  if (!result.success) {
    throw new InvalidLeadTransitionError(
      from,
      to,
      result.error.issues[0]?.message ??
        "Dữ liệu lead sau transition không hợp lệ",
    );
  }
  const parsed = result.data;
  const action = ACTION_BY_STATUS[to];
  if (action === undefined) {
    throw new InvalidLeadTransitionError(from, to, "Thiếu audit action");
  }
  return {
    ok: true,
    lead: parsed,
    audit: {
      action,
      leadId: parsed.id,
      postKey: parsed.post.postKey,
      ts: metadata.at,
      detail: { from, to },
    },
  };
};

export const tryTransitionLead = (
  lead: Lead,
  to: LeadStatus,
  metadata: TransitionMetadata,
): TransitionSuccess | TransitionFailure => {
  try {
    return transitionLead(lead, to, metadata);
  } catch (error) {
    const transitionError =
      error instanceof InvalidLeadTransitionError
        ? error
        : new InvalidLeadTransitionError(lead.status, to, String(error));
    return {
      ok: false,
      error: transitionError,
      auditDetail: {
        from: lead.status,
        to,
        code: "invalid_transition",
      },
    };
  }
};
