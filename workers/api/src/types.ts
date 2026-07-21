import type { AIProvider } from "./providers/types";
import type { WorkersAiBinding } from "./providers/workers-ai";

export interface ApiBindings {
  TEAM_TOKEN: string;
  EXTENSION_ORIGIN: string;
  AI_PROVIDER?: "mock" | "anthropic" | "workers_ai";
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_CLASSIFY_MODEL?: string;
  ANTHROPIC_DRAFT_MODEL?: string;
  // P6.2 — Workers AI (bậc miễn phí). AI là binding `env.AI`, KHÔNG phải key.
  WORKERS_AI_CLASSIFY_MODEL?: string;
  WORKERS_AI_DRAFT_MODEL?: string;
  AI?: WorkersAiBinding;
  API_RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}

export interface ApiVariables {
  inputBytes: number;
  rawBody: string;
  tokenHash: string;
}

export type ApiHonoEnv = {
  Bindings: ApiBindings;
  Variables: ApiVariables;
};

export interface ApiLogEvent {
  timestamp: string;
  route: string;
  method: string;
  status: number;
  latencyMs: number;
  inputBytes: number;
}

export interface ApiLogger {
  log(event: ApiLogEvent): void;
}

export interface AppDependencies {
  providerFactory?: (bindings: ApiBindings) => AIProvider;
  logger?: ApiLogger;
  now?: () => Date;
}
