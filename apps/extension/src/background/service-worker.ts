import type { ExtensionMessage } from "@flr/shared";
import { handleBackgroundMessage } from "./controller";
import { createPipelineApiClient } from "./api-client";
import { ReadOnlyPipeline } from "./pipeline";
import { chromeLocalStorage, ensureStorageDefaults } from "../lib/storage";

const broadcast = async (message: ExtensionMessage): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: "https://www.facebook.com/*" });
  await Promise.all([
    chrome.runtime.sendMessage(message).catch(() => undefined),
    ...tabs.flatMap((tab) =>
      tab.id === undefined
        ? []
        : [chrome.tabs.sendMessage(tab.id, message).catch(() => undefined)],
    ),
  ]);
};

const pipeline = new ReadOnlyPipeline({
  storage: chromeLocalStorage,
  api: createPipelineApiClient(),
  now: () => new Date(),
  broadcast,
});

let initialization: Promise<void> | undefined;
const initialize = (): Promise<void> => {
  initialization ??= (async () => {
    await chrome.storage.local.setAccessLevel({
      accessLevel: "TRUSTED_CONTEXTS",
    });
    await ensureStorageDefaults(chromeLocalStorage, new Date());
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await pipeline.resumeInterrupted();
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
};

const start = (): void => {
  void initialize().catch(() => console.error("FLR initialization failed"));
};

chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
start();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderUrl = sender.url ?? sender.tab?.url;
  void handleBackgroundMessage(message, senderUrl, {
    storage: chromeLocalStorage,
    now: () => new Date(),
    broadcast,
    pipeline,
  })
    .then(sendResponse)
    .catch(() => {
      console.error("FLR background message failed");
      sendResponse(undefined);
    });
  return true;
});
