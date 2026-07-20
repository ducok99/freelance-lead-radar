import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Freelance Lead Radar",
  short_name: "Lead Radar",
  description:
    "Phát hiện lead freelancer trong nhóm Facebook allowlist, luôn có người duyệt.",
  version: "0.6.0",
  minimum_chrome_version: "116",
  permissions: ["storage", "sidePanel"],
  host_permissions: [
    "https://www.facebook.com/*",
    "https://*.workers.dev/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
  ],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Freelance Lead Radar",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  options_page: "src/options/index.html",
  content_scripts: [
    {
      matches: ["https://www.facebook.com/*"],
      js: ["src/content/content-script.ts"],
      run_at: "document_idle",
    },
  ],
});
