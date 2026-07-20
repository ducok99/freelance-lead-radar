import { API_MAX_PAYLOAD_BYTES, API_RATE_LIMIT_PER_MINUTE } from "@flr/shared";
import type { MiddlewareHandler } from "hono";
import { ApiHttpError, apiErrorResponse } from "./errors";
import {
  constantTimeEqual,
  FixedWindowRateLimiter,
  hashToken,
} from "./security";
import type { ApiHonoEnv, ApiLogger } from "./types";

const parseBearerToken = (authorization: string | undefined): string | null => {
  if (authorization === undefined) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  return match?.[1] ?? null;
};

export const createCorsMiddleware =
  (): MiddlewareHandler<ApiHonoEnv> => async (context, next) => {
    const requestOrigin = context.req.header("Origin");
    const allowedOrigin = context.env.EXTENSION_ORIGIN;
    const originAllowed =
      requestOrigin !== undefined && requestOrigin === allowedOrigin;

    if (context.req.method === "OPTIONS") {
      if (!originAllowed) {
        return apiErrorResponse(
          context,
          new ApiHttpError(403, "unauthorized", "Origin không được phép"),
        );
      }

      context.header("Access-Control-Allow-Origin", allowedOrigin);
      context.header(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      context.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      context.header("Access-Control-Max-Age", "600");
      context.header("Vary", "Origin");
      return context.body(null, 204);
    }

    await next();

    if (originAllowed) {
      context.header("Access-Control-Allow-Origin", allowedOrigin);
      context.header("Vary", "Origin");
    }
  };

export const createMetadataLoggerMiddleware =
  (logger: ApiLogger, now: () => Date): MiddlewareHandler<ApiHonoEnv> =>
  async (context, next) => {
    const startedAt = now();
    context.set("inputBytes", 0);
    await next();
    const finishedAt = now();

    logger.log({
      timestamp: finishedAt.toISOString(),
      route: context.req.path,
      method: context.req.method,
      status: context.res.status,
      latencyMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      inputBytes: context.get("inputBytes"),
    });
  };

export const createAuthMiddleware =
  (): MiddlewareHandler<ApiHonoEnv> => async (context, next) => {
    const expected = context.env.TEAM_TOKEN;
    if (typeof expected !== "string" || expected.length === 0) {
      throw new ApiHttpError(
        500,
        "internal_error",
        "Cấu hình máy chủ không hợp lệ",
      );
    }

    const token = parseBearerToken(context.req.header("Authorization"));
    const tokenMatches = await constantTimeEqual(token ?? "", expected);
    if (token === null || !tokenMatches) {
      return apiErrorResponse(
        context,
        new ApiHttpError(401, "unauthorized", "Không được phép"),
      );
    }

    context.set("tokenHash", await hashToken(token));
    await next();
  };

export const createRateLimitMiddleware = (
  now: () => Date,
): MiddlewareHandler<ApiHonoEnv> => {
  const limiter = new FixedWindowRateLimiter(API_RATE_LIMIT_PER_MINUTE);
  return async (context, next) => {
    const tokenHash = context.get("tokenHash");
    const binding = context.env.API_RATE_LIMITER;
    const allowed =
      binding === undefined
        ? limiter.consume(tokenHash, now().getTime())
        : (await binding.limit({ key: tokenHash })).success;

    if (!allowed) {
      return apiErrorResponse(
        context,
        new ApiHttpError(429, "rate_limited", "Đã vượt giới hạn yêu cầu", true),
      );
    }
    await next();
  };
};

export const bodyLimitMiddleware: MiddlewareHandler<ApiHonoEnv> = async (
  context,
  next,
) => {
  const contentType = context.req.header("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return apiErrorResponse(
      context,
      new ApiHttpError(400, "invalid_request", "Yêu cầu phải là JSON"),
    );
  }

  const declaredLength = Number(context.req.header("Content-Length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > API_MAX_PAYLOAD_BYTES
  ) {
    return apiErrorResponse(
      context,
      new ApiHttpError(413, "payload_too_large", "Payload vượt quá 64KB"),
    );
  }

  const reader = context.req.raw.body?.getReader();
  const chunks: Uint8Array[] = [];
  let inputBytes = 0;
  let tooLarge = false;

  if (reader !== undefined) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        inputBytes += value.byteLength;
        if (inputBytes > API_MAX_PAYLOAD_BYTES) {
          tooLarge = true;
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  context.set("inputBytes", inputBytes);
  if (tooLarge) {
    return apiErrorResponse(
      context,
      new ApiHttpError(413, "payload_too_large", "Payload vượt quá 64KB"),
    );
  }

  const bytes = new Uint8Array(inputBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  context.set("rawBody", new TextDecoder().decode(bytes));
  await next();
};

export const parseJsonBody = (rawBody: string): unknown => {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ApiHttpError(400, "invalid_request", "JSON không hợp lệ");
  }
};
