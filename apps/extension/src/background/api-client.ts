import {
  API_PROVIDER_TIMEOUT_MS,
  ApiErrorResponseSchema,
  ClassifyRequestSchema,
  ClassifyResponseSchema,
  DraftRequestSchema,
  DraftResponseSchema,
  type ClassifyRequest,
  type ClassifyResponse,
  type DraftRequest,
  type DraftResponse,
  type Settings,
} from "@flr/shared";

export type PipelineApiErrorCode =
  "configuration_missing" | "network_error" | "api_error" | "invalid_response";

export class PipelineApiError extends Error {
  constructor(
    readonly code: PipelineApiErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PipelineApiError";
  }
}

export interface PipelineApiClient {
  classify(
    request: ClassifyRequest,
    settings: Settings,
  ): Promise<ClassifyResponse>;
  draft(request: DraftRequest, settings: Settings): Promise<DraftResponse>;
}

type FetchPort = (input: string, init: RequestInit) => Promise<Response>;

const endpoint = (baseUrl: string, path: string): string =>
  new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();

const requestJson = async <T>(input: {
  path: string;
  body: unknown;
  settings: Settings;
  fetcher: FetchPort;
  parse: (value: unknown) => T | undefined;
}): Promise<T> => {
  if (input.settings.apiBaseUrl === "" || input.settings.teamToken === "") {
    throw new PipelineApiError(
      "configuration_missing",
      "Hãy cấu hình API Base URL và TEAM_TOKEN trước khi quét bài.",
      true,
    );
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    API_PROVIDER_TIMEOUT_MS,
  );
  try {
    const response = await input.fetcher(
      endpoint(input.settings.apiBaseUrl, input.path),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.settings.teamToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.body),
        signal: controller.signal,
      },
    );
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = ApiErrorResponseSchema.safeParse(payload);
      throw new PipelineApiError(
        "api_error",
        error.success ? error.data.error.message : "Workers API trả lỗi.",
        error.success ? error.data.error.retryable : response.status >= 500,
      );
    }
    const parsed = input.parse(payload);
    if (parsed === undefined) {
      throw new PipelineApiError(
        "invalid_response",
        "Workers API trả dữ liệu không hợp lệ.",
        true,
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof PipelineApiError) throw error;
    throw new PipelineApiError(
      "network_error",
      "Không kết nối được Workers API.",
      true,
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

export const createPipelineApiClient = (
  fetcher: FetchPort = (input, init) => fetch(input, init),
): PipelineApiClient => ({
  classify(request, settings) {
    const body = ClassifyRequestSchema.parse(request);
    return requestJson({
      path: "v1/classify",
      body,
      settings,
      fetcher,
      parse(value) {
        const parsed = ClassifyResponseSchema.safeParse(value);
        return parsed.success ? parsed.data : undefined;
      },
    });
  },
  draft(request, settings) {
    const body = DraftRequestSchema.parse(request);
    return requestJson({
      path: "v1/draft",
      body,
      settings,
      fetcher,
      parse(value) {
        const parsed = DraftResponseSchema.safeParse(value);
        return parsed.success ? parsed.data : undefined;
      },
    });
  },
});
