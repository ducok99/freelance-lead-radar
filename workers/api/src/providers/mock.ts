import type { ClassifyRequest, DraftRequest, SkillField } from "@flr/shared";
import type { AIProvider, ProviderAttemptContext } from "./types";

type MockResponder<TRequest> = (
  request: TRequest,
  context: ProviderAttemptContext,
) => unknown | Promise<unknown>;

export interface MockProviderOptions {
  classify?: MockResponder<ClassifyRequest>;
  draftComment?: MockResponder<DraftRequest>;
}

const defaultField = (request: ClassifyRequest): SkillField =>
  request.teamSkills[0] ?? "other";

const defaultClassify: MockResponder<ClassifyRequest> = (request) => ({
  results: request.posts.map((post) => ({
    postKey: post.postKey,
    classification: "hiring_freelancer",
    confidence: 0.93,
    scoreBreakdown: {
      intent: 36,
      budget: 0,
      fieldMatch: 15,
      urgency: 0,
      contact: post.anonymousPoster ? 2 : 6,
      quality: 8,
      adjustments: [],
    },
    extraction: {
      jobSummary: post.text.trim().slice(0, 1_000) || "Nhu cầu freelancer",
      field: defaultField(request),
      tools: [],
      contacts: [],
    },
  })),
});

const defaultDraft: MockResponder<DraftRequest> = (request) => ({
  draft: {
    aiText: `Mình đã đọc nhu cầu ${request.extraction.jobSummary.toLocaleLowerCase("vi")}. Team mình có năng lực phù hợp; bạn ib mình để trao đổi và xem portfolio nhé.`,
    rationale: "Nháp bám nhu cầu, nêu năng lực ở mức trung tính và có CTA nhẹ.",
  },
});

export class MockProvider implements AIProvider {
  classifyCalls = 0;
  draftCalls = 0;
  readonly #classify: MockResponder<ClassifyRequest>;
  readonly #draftComment: MockResponder<DraftRequest>;

  constructor(options: MockProviderOptions = {}) {
    this.#classify = options.classify ?? defaultClassify;
    this.#draftComment = options.draftComment ?? defaultDraft;
  }

  async classify(
    request: ClassifyRequest,
    context: ProviderAttemptContext,
  ): Promise<unknown> {
    this.classifyCalls += 1;
    return this.#classify(request, context);
  }

  async draftComment(
    request: DraftRequest,
    context: ProviderAttemptContext,
  ): Promise<unknown> {
    this.draftCalls += 1;
    return this.#draftComment(request, context);
  }
}
