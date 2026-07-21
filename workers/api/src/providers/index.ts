import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import {
  DEFAULT_WORKERS_AI_CLASSIFY_MODEL,
  DEFAULT_WORKERS_AI_DRAFT_MODEL,
  WorkersAiProvider,
} from "./workers-ai";
import type { AIProvider } from "./types";
import type { ApiBindings } from "../types";

const required = (value: string | undefined, name: string): string => {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing provider configuration: ${name}`);
  }
  return value;
};

const withDefault = (value: string | undefined, fallback: string): string =>
  value !== undefined && value.trim().length > 0 ? value.trim() : fallback;

export const createProvider = (bindings: ApiBindings): AIProvider => {
  if (bindings.AI_PROVIDER === "mock") {
    return new MockProvider();
  }

  if (bindings.AI_PROVIDER === "workers_ai") {
    if (bindings.AI === undefined) {
      throw new Error("Missing provider configuration: AI binding");
    }
    return new WorkersAiProvider({
      ai: bindings.AI,
      classifyModel: withDefault(
        bindings.WORKERS_AI_CLASSIFY_MODEL,
        DEFAULT_WORKERS_AI_CLASSIFY_MODEL,
      ),
      draftModel: withDefault(
        bindings.WORKERS_AI_DRAFT_MODEL,
        DEFAULT_WORKERS_AI_DRAFT_MODEL,
      ),
    });
  }

  return new AnthropicProvider({
    apiKey: required(bindings.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY"),
    classifyModel: required(
      bindings.ANTHROPIC_CLASSIFY_MODEL,
      "ANTHROPIC_CLASSIFY_MODEL",
    ),
    draftModel: required(
      bindings.ANTHROPIC_DRAFT_MODEL,
      "ANTHROPIC_DRAFT_MODEL",
    ),
  });
};

export * from "./anthropic";
export * from "./mock";
export * from "./workers-ai";
export * from "./types";
