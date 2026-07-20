import { readFileSync } from "node:fs";
import { stdout } from "node:process";
import { fileURLToPath, URL } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const manifest = JSON.parse(readFileSync(`${dist}/manifest.json`, "utf8"));
const loader = readFileSync(`${dist}/service-worker-loader.js`, "utf8");
const workerImport = loader.match(
  /["']\.\/(assets\/service-worker\.ts-[^"']+\.js)["']/,
)?.[1];

if (workerImport === undefined) {
  throw new Error(
    "Build lỗi: service-worker-loader không nạp entry service-worker duy nhất.",
  );
}

const contentEntries = (manifest.content_scripts ?? []).flatMap(
  (entry) => entry.js ?? [],
);
if (
  contentEntries.some((entry) => entry.includes("service-worker")) ||
  workerImport.includes("content-script")
) {
  throw new Error("Build lỗi: service worker và content script bị hoán đổi.");
}

const worker = readFileSync(`${dist}/${workerImport}`, "utf8");
for (const requiredSignal of [
  "chrome.runtime.onMessage.addListener",
  "chrome.storage.local.setAccessLevel",
]) {
  if (!worker.includes(requiredSignal)) {
    throw new Error(
      `Build lỗi: background chunk thiếu tín hiệu ${requiredSignal}.`,
    );
  }
}

stdout.write(
  "✅ verify-extension-build: service worker và content script đúng entry.\n",
);
