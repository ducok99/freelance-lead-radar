import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { fileURLToPath } from "node:url";
import { ClassifyResponseSchema } from "@flr/shared";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";

const extensionPath = fileURLToPath(new URL("../dist", import.meta.url));
const NOW = "2026-07-20T08:00:00.000Z";

const launchExtension = async (): Promise<BrowserContext> =>
  chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

const post = (id: number, text: string) => `
  <div role="article">
    <h2><a role="link" href="https://www.facebook.com/profile.php?id=${id}">Tác giả ${id}</a></h2>
    <div data-ad-preview="message">${text}</div>
    <a href="https://www.facebook.com/groups/p6fixture/posts/${id}/">1 giờ</a>
  </div>`;

const feed = `<!doctype html><html><body><main role="feed">
  ${post(101, "Cần thuê designer thiết kế logo, budget rõ ràng.")}
  ${post(102, "Cần bạn edit video TikTok cho dự án.")}
  ${post(103, "Mình đang nhận job thiết kế, đây là portfolio của mình.")}
  ${post(104, "Tuyển nhân viên thiết kế full-time, gửi CV phỏng vấn.")}
  ${post(105, "Việc nhẹ lương cao, chỉ cần điện thoại kiếm tiền mỗi ngày.")}
  ${post(106, "Cần thuê kiến trúc sư dựng phối cảnh, ngân sách tốt.")}
  ${post(107, "Cần freelancer làm website React, có budget.")}
  ${post(108, "Cần thiết kế banner nhưng không làm việc với agency team.")}
  ${post(109, "Cần designer làm test mẫu miễn phí trước khi nhận việc.")}
  ${post(110, "Thông báo sự kiện cộng đồng cuối tuần.")}
</main></body></html>`;

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  request.setEncoding("utf8");
  let body = "";
  for await (const chunk of request) body += String(chunk);
  return JSON.parse(body) as unknown;
};

const scoreBreakdownFor = (target: number) => {
  let remaining = Math.max(0, Math.min(100, target));
  const take = (maximum: number): number => {
    const value = Math.min(maximum, remaining);
    remaining -= value;
    return value;
  };
  return {
    intent: take(40),
    budget: take(15),
    fieldMatch: take(15),
    urgency: take(10),
    contact: take(10),
    quality: take(10),
    adjustments: [],
  };
};

test("P6 pipeline chỉ đọc: batch, dedupe, UI review và audit", async () => {
  let classifyCalls = 0;
  let draftCalls = 0;
  const server = createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "authorization, content-type",
      );
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      if (request.method === "OPTIONS") {
        response.writeHead(204).end();
        return;
      }
      const payload = (await readJson(request)) as {
        posts?: Array<{ postKey: string; text: string }>;
        postKey?: string;
      };
      response.setHeader("Content-Type", "application/json; charset=utf-8");

      if (request.url === "/v1/classify") {
        classifyCalls += 1;
        const results = (payload.posts ?? []).map((item) => {
          const id = item.postKey.split(":")[1];
          const score =
            id === "102" ? 72 : id === "106" ? 96 : id === "107" ? 82 : 88;
          const classification = id === "110" ? "other" : "hiring_freelancer";
          const field =
            id === "102"
              ? "video_editing"
              : id === "106"
                ? "architecture"
                : id === "107"
                  ? "web_dev"
                  : "graphic_design";
          return {
            postKey: item.postKey,
            classification,
            confidence: 0.93,
            scoreBreakdown: scoreBreakdownFor(score),
            extraction: {
              jobSummary: item.text,
              field,
              tools: [],
              contacts: [],
            },
          };
        });
        response.end(
          JSON.stringify(
            ClassifyResponseSchema.parse({ results, schemaVersion: 1 }),
          ),
        );
        return;
      }

      if (request.url === "/v1/draft") {
        draftCalls += 1;
        response.end(
          JSON.stringify({
            draft: {
              aiText: `Team mình phù hợp bài ${payload.postKey ?? "này"}; bạn nhắn để xem portfolio nhé.`,
              rationale: "Bám đúng nhu cầu và có CTA nhẹ.",
              createdAt: NOW,
            },
            schemaVersion: 1,
          }),
        );
        return;
      }

      response.writeHead(404).end();
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Không mở được mock API");
  }

  const context = await launchExtension();
  try {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent("serviceworker");
    const extensionId = new URL(serviceWorker.url()).host;
    await serviceWorker.evaluate(
      async ({ apiBaseUrl }) => {
        const current = await chrome.storage.local.get("flr:settings");
        const base = current["flr:settings"] as Record<string, unknown>;
        await chrome.storage.local.set({
          "flr:settings": {
            ...base,
            allowlist: [
              {
                groupId: "p6fixture",
                name: "P6 Fixture",
                url: "https://www.facebook.com/groups/p6fixture",
                active: true,
              },
            ],
            teamProfile: "Team thiết kế, video, web và kiến trúc.",
            apiBaseUrl,
            teamToken: "a".repeat(32),
          },
        });
      },
      { apiBaseUrl: `http://127.0.0.1:${address.port}` },
    );

    const page = await context.newPage();
    await page.route("https://www.facebook.com/**", (route) =>
      route.fulfill({ contentType: "text/html; charset=utf-8", body: feed }),
    );
    await page.goto("https://www.facebook.com/groups/p6fixture");

    await expect
      .poll(() =>
        serviceWorker.evaluate(async () => {
          const stored = await chrome.storage.local.get("flr:leads");
          return Object.keys(
            (stored["flr:leads"] as Record<string, unknown> | undefined) ?? {},
          ).length;
        }),
      )
      .toBe(10);

    const summary = await serviceWorker.evaluate(async () => {
      const stored = await chrome.storage.local.get(["flr:leads", "flr:audit"]);
      const leads = Object.values(
        stored["flr:leads"] as Record<
          string,
          { score: number; status: string; post: { postKey: string } }
        >,
      );
      const audits = stored["flr:audit"] as Array<{ action: string }>;
      return {
        leads,
        actions: audits.map((event) => event.action),
      };
    });
    expect(
      summary.leads.filter((lead) => lead.status === "needs_review"),
    ).toHaveLength(3);
    expect(
      summary.leads.find((lead) => lead.post.postKey === "p6fixture:106")
        ?.score,
    ).toBe(96);
    expect(summary.actions).toEqual(
      expect.arrayContaining([
        "post_detected",
        "filtered",
        "ai_classified",
        "draft_created",
      ]),
    );
    expect(classifyCalls).toBe(1);
    expect(draftCalls).toBe(3);

    await page.reload();
    await page.waitForTimeout(400);
    expect(classifyCalls).toBe(1);

    const sidePanel = await context.newPage();
    await sidePanel.goto(
      `chrome-extension://${extensionId}/src/sidepanel/index.html`,
    );
    await expect(
      sidePanel.locator('[data-lead-status="needs_review"]'),
    ).toHaveCount(3);
    const first = sidePanel
      .locator('[data-lead-status="needs_review"]')
      .first();
    await first
      .locator("textarea")
      .fill("Nháp đã sửa để trao đổi portfolio phù hợp.");
    await first.getByRole("button", { name: "Lưu nháp" }).click();
    await first.getByRole("button", { name: "Duyệt lead" }).click();
    await expect(
      sidePanel.locator('[data-lead-status="approved"]'),
    ).toHaveCount(1);
    await expect(
      sidePanel.getByRole("button", { name: /Chèn|Đăng/i }),
    ).toHaveCount(0);

    const finalActions = await serviceWorker.evaluate(async () => {
      const stored = await chrome.storage.local.get("flr:audit");
      return (stored["flr:audit"] as Array<{ action: string }>).map(
        (event) => event.action,
      );
    });
    expect(finalActions).toEqual(
      expect.arrayContaining(["draft_edited", "approved"]),
    );
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  }
});
