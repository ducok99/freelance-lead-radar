import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { AIProvider } from "./types";
import type { ApiBindings } from "../types";

const required = (value: string | undefined, name: string): string => {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing provider configuration: ${name}`);
  }
  return value;
};

export const createProvider = (bindings: ApiBindings): AIProvider => {
  if (bindings.AI_PROVIDER === "mock") {
    return new MockProvider();
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
export * from "./types";
