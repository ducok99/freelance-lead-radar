import { describe, expect, it } from "vitest";
import manifest from "../manifest.config";

const resolveManifest = async () =>
  typeof manifest === "function"
    ? manifest({ command: "build", mode: "test" })
    : Promise.resolve(manifest);

describe("Manifest MV3 quyền tối thiểu", () => {
  it("khóa đúng permission và host permission đã được DUC duyệt", async () => {
    const resolved = await resolveManifest();
    expect(resolved.manifest_version).toBe(3);
    expect(resolved.version).toBe("0.6.0");
    expect(resolved.minimum_chrome_version).toBe("116");
    expect(resolved.permissions).toEqual(["storage", "sidePanel"]);
    expect(resolved.host_permissions).toEqual([
      "https://www.facebook.com/*",
      "https://*.workers.dev/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ]);
  });

  it("không xin quyền nhạy cảm hoặc all_urls", async () => {
    const serialized = JSON.stringify(await resolveManifest());
    for (const forbidden of [
      "cookies",
      "tabs",
      "webRequest",
      "scripting",
      "history",
      "<all_urls>",
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it("khai báo service worker, content gate và ba UI shell", async () => {
    const resolved = await resolveManifest();
    expect(resolved.background).toEqual({
      service_worker: "src/background/service-worker.ts",
      type: "module",
    });
    expect(resolved.content_scripts).toHaveLength(1);
    expect(resolved.content_scripts?.[0]?.js).toEqual([
      "src/content/content-script.ts",
    ]);
    const backgroundEntry =
      resolved.background !== undefined &&
      "service_worker" in resolved.background
        ? resolved.background.service_worker
        : undefined;
    expect(backgroundEntry).not.toBe(resolved.content_scripts?.[0]?.js?.[0]);
    expect(resolved.action?.default_popup).toBe("src/popup/index.html");
    expect(resolved.side_panel?.default_path).toBe("src/sidepanel/index.html");
    expect(resolved.options_page).toBe("src/options/index.html");
  });
});
