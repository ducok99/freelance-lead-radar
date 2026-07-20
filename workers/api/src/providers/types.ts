import type { ClassifyRequest, DraftRequest } from "@flr/shared";

export interface ProviderAttemptContext {
  attempt: 1 | 2;
  repairInstruction?: string;
}

export interface AIProvider {
  classify(
    request: ClassifyRequest,
    context: ProviderAttemptContext,
  ): Promise<unknown>;
  draftComment(
    request: DraftRequest,
    context: ProviderAttemptContext,
  ): Promise<unknown>;
}
