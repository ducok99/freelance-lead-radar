import { startContentGate } from "./gate";
import { ContentScanner } from "./pipeline";

const scanner = new ContentScanner({
  root: document,
  currentUrl: () => location.href,
  now: () => new Date(),
  sendMessage: (message) => chrome.runtime.sendMessage(message),
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  scanner.handleMessage(message);
});

void startContentGate({
  body: document.body,
  sendMessage: (message) => chrome.runtime.sendMessage(message),
  scan: () => scanner.scan(),
  createObserver: (callback) => new MutationObserver(callback),
  addMessageListener(listener) {
    const chromeListener = (message: unknown) => listener(message);
    chrome.runtime.onMessage.addListener(chromeListener);
    return () => chrome.runtime.onMessage.removeListener(chromeListener);
  },
});
