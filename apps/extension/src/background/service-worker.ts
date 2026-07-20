import type { ExtensionMessage, Lead } from "@flr/shared";
import { handleBackgroundMessage } from "./controller";
import { createPipelineApiClient } from "./api-client";
import { ReadOnlyPipeline } from "./pipeline";
import {
  createLeadNotifier,
  notificationTarget,
  type LeadNotification,
} from "./notifications";
import {
  chromeLocalStorage,
  ensureStorageDefaults,
  readSettings,
} from "../lib/storage";

// P6.1: badge màu hổ phách đếm số lead đang chờ duyệt trên icon extension.
const BADGE_BACKGROUND_COLOR = "#b45309";
// Icon nằm trong apps/extension/public/, được Vite copy vào gốc dist.
const NOTIFICATION_ICON_PATH = "icon-128.png";

const updatePendingBadge = async (leads: readonly Lead[]): Promise<void> => {
  const pending = leads.filter((lead) => lead.status === "needs_review").length;
  await chrome.action.setBadgeText({
    text: pending === 0 ? "" : String(pending),
  });
};

const broadcast = async (message: ExtensionMessage): Promise<void> => {
  if (message.type === "LEADS_UPDATED") {
    await updatePendingBadge(message.leads).catch(() => undefined);
  }
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

// P6.1: hiển thị thông báo desktop cục bộ của Chrome — không gửi dữ liệu đi
// đâu, không tương tác gì với Facebook (SECURITY.md §4).
const showLeadNotification = async (
  notification: LeadNotification,
): Promise<void> => {
  await chrome.notifications.create(notification.id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
    title: notification.title,
    message: notification.message,
    priority: 2,
  });
};

const pipeline = new ReadOnlyPipeline({
  storage: chromeLocalStorage,
  api: createPipelineApiClient(),
  now: () => new Date(),
  broadcast,
  notify: createLeadNotifier({
    getSettings: () => readSettings(chromeLocalStorage),
    show: showLeadNotification,
  }),
});

let initialization: Promise<void> | undefined;
const initialize = (): Promise<void> => {
  initialization ??= (async () => {
    await chrome.storage.local.setAccessLevel({
      accessLevel: "TRUSTED_CONTEXTS",
    });
    await ensureStorageDefaults(chromeLocalStorage, new Date());
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.action.setBadgeBackgroundColor({
      color: BADGE_BACKGROUND_COLOR,
    });
    await updatePendingBadge(await pipeline.listLeads());
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

// P6.1: bấm vào thông báo là HÀNH ĐỘNG CHỦ ĐỘNG của người dùng — mở đúng bài
// viết của lead (hoặc hàng đợi duyệt nếu là thông báo tổng/lead không còn).
// Đây không phải extension tự điều hướng (ADR-01 vẫn nguyên vẹn).
chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    const target = notificationTarget(notificationId);
    if (target === null) return;
    await chrome.notifications.clear(notificationId);
    if (target.kind === "lead") {
      const lead = (await pipeline.listLeads()).find(
        (item) => item.post.postKey === target.postKey,
      );
      if (lead !== undefined) {
        await chrome.tabs.create({ url: lead.post.permalink });
        return;
      }
    }
    await chrome.tabs.create({
      url: chrome.runtime.getURL("src/sidepanel/index.html"),
    });
  })().catch(() => console.error("FLR notification click failed"));
});
