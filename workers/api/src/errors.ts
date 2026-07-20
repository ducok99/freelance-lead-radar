import { ApiErrorResponseSchema, type ApiErrorCode } from "@flr/shared";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiHonoEnv } from "./types";

export class ApiHttpError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly status: ContentfulStatusCode;

  constructor(
    status: ContentfulStatusCode,
    code: ApiErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export const apiErrorResponse = (
  context: Context<ApiHonoEnv>,
  error: ApiHttpError,
) =>
  context.json(
    ApiErrorResponseSchema.parse({
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    }),
    error.status,
  );

export const invalidRequest = () =>
  new ApiHttpError(400, "invalid_request", "Yêu cầu không hợp lệ");

export const aiUnavailable = () =>
  new ApiHttpError(502, "ai_unavailable", "AI tạm thời không khả dụng", true);
