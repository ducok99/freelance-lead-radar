import {
  ClassifyRequestSchema,
  DraftRequestSchema,
  HealthResponseSchema,
} from "@flr/shared";
import { Hono } from "hono";
import { ApiHttpError, apiErrorResponse, invalidRequest } from "./errors";
import {
  bodyLimitMiddleware,
  createAuthMiddleware,
  createCorsMiddleware,
  createMetadataLoggerMiddleware,
  createRateLimitMiddleware,
  parseJsonBody,
} from "./middleware";
import {
  callProviderWithRetry,
  parseClassifyOutput,
  parseDraftOutput,
} from "./provider-output";
import { createProvider } from "./providers";
import type {
  ApiHonoEnv,
  ApiLogEvent,
  ApiLogger,
  AppDependencies,
} from "./types";

const consoleLogger: ApiLogger = {
  log(event: ApiLogEvent) {
    console.info(JSON.stringify(event));
  },
};

export const createApp = (dependencies: AppDependencies = {}) => {
  const app = new Hono<ApiHonoEnv>();
  const now = dependencies.now ?? (() => new Date());
  const logger = dependencies.logger ?? consoleLogger;
  const providerFactory = dependencies.providerFactory ?? createProvider;
  const auth = createAuthMiddleware();
  const rateLimit = createRateLimitMiddleware(now);

  app.use("/v1/*", createCorsMiddleware());
  app.use("/v1/*", createMetadataLoggerMiddleware(logger, now));

  app.options("/v1/*", (context) => context.body(null, 204));

  app.get("/v1/health", (context) =>
    context.json(HealthResponseSchema.parse({ ok: true })),
  );

  app.post(
    "/v1/classify",
    auth,
    rateLimit,
    bodyLimitMiddleware,
    async (context) => {
      const request = ClassifyRequestSchema.safeParse(
        parseJsonBody(context.get("rawBody")),
      );
      if (!request.success) throw invalidRequest();

      let provider;
      try {
        provider = providerFactory(context.env);
      } catch {
        throw new ApiHttpError(
          502,
          "ai_unavailable",
          "AI tạm thời không khả dụng",
          true,
        );
      }

      const response = await callProviderWithRetry(
        (attempt) => provider.classify(request.data, attempt),
        (output) => parseClassifyOutput(output, request.data),
      );
      return context.json(response);
    },
  );

  app.post(
    "/v1/draft",
    auth,
    rateLimit,
    bodyLimitMiddleware,
    async (context) => {
      const request = DraftRequestSchema.safeParse(
        parseJsonBody(context.get("rawBody")),
      );
      if (!request.success) throw invalidRequest();

      let provider;
      try {
        provider = providerFactory(context.env);
      } catch {
        throw new ApiHttpError(
          502,
          "ai_unavailable",
          "AI tạm thời không khả dụng",
          true,
        );
      }

      const response = await callProviderWithRetry(
        (attempt) => provider.draftComment(request.data, attempt),
        (output) => parseDraftOutput(output, now().toISOString()),
      );
      return context.json(response);
    },
  );

  app.notFound((context) =>
    apiErrorResponse(
      context,
      new ApiHttpError(404, "invalid_request", "Không tìm thấy endpoint"),
    ),
  );

  app.onError((error, context) =>
    apiErrorResponse(
      context,
      error instanceof ApiHttpError
        ? error
        : new ApiHttpError(
            500,
            "internal_error",
            "Máy chủ gặp lỗi nội bộ",
            true,
          ),
    ),
  );

  return app;
};

const app = createApp();

export default app;
export * from "./errors";
export * from "./provider-output";
export * from "./providers";
export * from "./security";
export * from "./types";
