import { fileURLToPath } from "node:url";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";

const extensionPath = fileURLToPath(new URL("../dist", import.meta.url));

const launchExtension = async (): Promise<BrowserContext> =>
  chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

test("nhóm ngoài allowlist không ghi lead, dedupe hay audit", async () => {
  const context = await launchExtension();

  try {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent("serviceworker");

    await serviceWorker.evaluate(() => {
      const scope = globalThis as typeof globalThis & {
        __flrObservedMessageTypes?: string[];
      };
      scope.__flrObservedMessageTypes = [];
      chrome.runtime.onMessage.addListener((input: unknown) => {
        if (
          typeof input === "object" &&
          input !== null &&
          "type" in input &&
          typeof input.type === "string"
        ) {
          scope.__flrObservedMessageTypes?.push(input.type);
        }
      });
    });

    const page = await context.newPage();
    await page.route("https://www.facebook.com/**", (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><body>
          <main role="main">
            <div role="article">Fixture local, không phải dữ liệu Facebook thật.</div>
          </main>
        </body></html>`,
      }),
    );

    await page.goto(
      "https://www.facebook.com/groups/group-khong-nam-trong-allowlist",
    );
    await page.waitForTimeout(300);

    const result = await serviceWorker.evaluate(async () => {
      const manifest = chrome.runtime.getManifest();
      const stored = await chrome.storage.local.get([
        "flr:leads",
        "flr:dedupe",
        "flr:audit",
        "flr:counters",
      ]);
      const scope = globalThis as typeof globalThis & {
        __flrObservedMessageTypes?: string[];
      };
      return {
        manifest,
        observedMessageTypes: scope.__flrObservedMessageTypes ?? [],
        stored,
      };
    });

    expect(result.manifest.permissions).toEqual(["storage", "sidePanel"]);
    expect(result.manifest.host_permissions).toEqual([
      "https://www.facebook.com/*",
      "https://*.workers.dev/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ]);
    expect(result.observedMessageTypes).toContain("GET_GATE_STATE");
    expect(result.observedMessageTypes).not.toContain("POST_SEEN");
    expect(result.stored["flr:leads"]).toBeUndefined();
    expect(result.stored["flr:dedupe"]).toBeUndefined();
    expect(result.stored["flr:audit"]).toBeUndefined();
    expect(result.stored["flr:counters"]).toMatchObject({
      extractionAttempts: 0,
      extractionFailures: 0,
    });
  } finally {
    await context.close();
  }
});
