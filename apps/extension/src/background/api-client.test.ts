import {
  DEFAULT_SETTINGS,
  type ClassifyRequest,
  type Settings,
} from "@flr/shared";
import { describe, expect, it, vi } from "vitest";
import { createPipelineApiClient, PipelineApiError } from "./api-client";

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  apiBaseUrl: "https://flr-api.example.workers.dev",
  teamToken: "a".repeat(32),
};

const request: ClassifyRequest = {
  posts: [
    {
      postKey: "group:post",
      text: "Cần thuê freelancer thiết kế logo.",
      anonymousPoster: false,
      truncated: false,
    },
  ],
  teamSkills: ["graphic_design"],
  schemaVersion: 1,
};

describe("pipeline API client", () => {
  it("gửi bearer tới đúng classify endpoint và validate response", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                postKey: "group:post",
                classification: "hiring_freelancer",
                confidence: 0.93,
                scoreBreakdown: {
                  intent: 36,
                  budget: 10,
                  fieldMatch: 15,
                  urgency: 8,
                  contact: 6,
                  quality: 8,
                  adjustments: [],
                },
                extraction: {
                  jobSummary: "Thiết kế logo",
                  field: "graphic_design",
                  tools: [],
                  contacts: [],
                },
              },
            ],
            schemaVersion: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const client = createPipelineApiClient(fetcher);

    await expect(client.classify(request, settings)).resolves.toMatchObject({
      results: [{ postKey: "group:post" }],
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://flr-api.example.workers.dev/v1/classify",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${settings.teamToken}`,
        }),
      }),
    );
  });

  it("thiếu cấu hình fail rõ ràng và không gọi mạng", async () => {
    const fetcher = vi.fn();
    const client = createPipelineApiClient(fetcher);
    await expect(client.classify(request, DEFAULT_SETTINGS)).rejects.toEqual(
      expect.objectContaining<Partial<PipelineApiError>>({
        code: "configuration_missing",
        retryable: true,
      }),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("response sai schema trở thành lỗi retryable", async () => {
    const client = createPipelineApiClient(() =>
      Promise.resolve(new Response(JSON.stringify({ results: [] }))),
    );
    await expect(client.classify(request, settings)).rejects.toEqual(
      expect.objectContaining<Partial<PipelineApiError>>({
        code: "invalid_response",
        retryable: true,
      }),
    );
  });
});
