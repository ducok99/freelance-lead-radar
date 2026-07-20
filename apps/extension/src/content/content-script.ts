import { startContentGate } from "./gate";

void startContentGate({
  body: document.body,
  sendMessage: (message) => chrome.runtime.sendMessage(message),
  createObserver: (callback) => new MutationObserver(callback),
  addMessageListener(listener) {
    const chromeListener = (message: unknown) => listener(message);
    chrome.runtime.onMessage.addListener(chromeListener);
    return () => chrome.runtime.onMessage.removeListener(chromeListener);
  },
});
