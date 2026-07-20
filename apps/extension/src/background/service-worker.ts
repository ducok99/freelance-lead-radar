import type { ExtensionMessage } from "@flr/shared";
import { handleBackgroundMessage } from "./controller";
import { chromeLocalStorage, ensureStorageDefaults } from "../lib/storage";

const broadcast = async (message: ExtensionMessage): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: "https://www.facebook.com/*" });
  await Promise.all(
    tabs.flatMap((tab) =>
      tab.id === undefined
        ? []
        : [chrome.tabs.sendMessage(tab.id, message).catch(() => undefined)],
    ),
  );
};

const initialize = async (): Promise<void> => {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  await ensureStorageDefaults(chromeLocalStorage, new Date());
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
};

chrome.runtime.onInstalled.addListener(() => void initialize());
chrome.runtime.onStartup.addListener(() => void initialize());
void initialize();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderUrl = sender.url ?? sender.tab?.url;
  void handleBackgroundMessage(message, senderUrl, {
    storage: chromeLocalStorage,
    now: () => new Date(),
    broadcast,
  })
    .then(sendResponse)
    .catch(() => {
      console.error("FLR background message failed");
      sendResponse(undefined);
    });
  return true;
});
