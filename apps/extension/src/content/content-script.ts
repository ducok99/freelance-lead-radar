import { startContentGate, type ContentGateResult } from "./gate";
import { ContentScanner } from "./pipeline";

const scanner = new ContentScanner({
  root: document,
  currentUrl: () => location.href,
  now: () => new Date(),
  sendMessage: (message) => chrome.runtime.sendMessage(message),
  // P6.7: mỗi lượt quét có thay đổi in một dòng [FLR] vào Console để chẩn
  // đoán bằng mắt (số bài thấy / gửi mới / lỗi trích xuất, hoặc cảnh báo).
  report: (line) => console.info(line),
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  scanner.handleMessage(message);
});

// P6.6: chẩn đoán được bằng mắt. Trước đây gate chết IM LẶNG (vd nền
// extension chưa dậy kịp lúc trang tải, hoặc Chrome không nạp content script)
// khiến không thể phân biệt "không được nạp" với "nạp rồi nhưng bắt tay hụt".
// Giờ content script luôn in đúng MỘT dòng "[FLR] ..." nói rõ trạng thái, và
// tự thử bắt tay lại vài lần khi nền chưa phản hồi. Không đổi hành vi
// pipeline; log không chứa nội dung bài viết hay dữ liệu cá nhân nào.
const GATE_RETRY_DELAYS_MS = [1_000, 3_000, 8_000];

const GATE_REASON_LABELS: Record<ContentGateResult["reason"], string> = {
  active: "đang hoạt động — đọc các bài hiển thị trong tab này.",
  not_allowlisted: "nhóm này ngoài allowlist — không đọc gì ở tab này.",
  stopped: "pipeline đang dừng an toàn (Emergency Stop hoặc circuit breaker).",
  unavailable: "không bắt tay được với nền extension sau nhiều lần thử.",
};

const runGate = (): Promise<ContentGateResult> =>
  startContentGate({
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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

void (async () => {
  let result = await runGate();
  for (const delayMs of GATE_RETRY_DELAYS_MS) {
    if (result.reason !== "unavailable") break;
    console.info(
      `[FLR] Chưa bắt tay được với nền extension, thử lại sau ${String(delayMs / 1_000)}s...`,
    );
    await sleep(delayMs);
    result = await runGate();
  }
  console.info(
    `[FLR] v${chrome.runtime.getManifest().version}: ${GATE_REASON_LABELS[result.reason]}`,
  );
})().catch(() => console.error("[FLR] Lỗi không xác định khi khởi động."));
