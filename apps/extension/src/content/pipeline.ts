import {
  ExtensionMessageSchema,
  type ExtensionMessage,
  type LeadStatus,
} from "@flr/shared";
import {
  detectWarningSignals,
  extractPost,
  findPostElements,
  isExtractionFailure,
} from "@flr/facebook-adapter";

export interface ContentScannerPorts {
  root: ParentNode;
  currentUrl: () => string;
  now: () => Date;
  sendMessage: (message: ExtensionMessage) => Promise<unknown>;
  /**
   * P6.7: nhận một dòng trạng thái ngắn sau mỗi lượt quét có thay đổi (số bài
   * thấy, số gửi mới, số lỗi trích xuất, hoặc cảnh báo Facebook). Chỉ để hiển
   * thị chẩn đoán (console) — không chứa nội dung bài viết hay dữ liệu cá
   * nhân. Không truyền thì im lặng như cũ.
   */
  report?: (line: string) => void;
}

const badgeText = (score: number, status: LeadStatus): string => {
  if (status === "filtered_out") return "FL · Đã lọc";
  if (status === "below_threshold") return `FL · ${score} · Dưới ngưỡng`;
  if (status === "detected") return "FL · Đang xử lý";
  return `FL · ${score} điểm`;
};

export class ContentScanner {
  readonly #sentText = new Map<string, string>();
  readonly #sending = new Set<string>();
  readonly #failed = new WeakSet<Element>();
  readonly #articles = new Map<string, Element>();
  readonly #badgeRoots = new WeakMap<Element, ShadowRoot>();
  #warningSent = false;
  #warningSending = false;
  #lastReport = "";

  constructor(private readonly ports: ContentScannerPorts) {}

  // P6.7: chỉ báo khi nội dung dòng thay đổi — MutationObserver gọi scan rất
  // dày, không được spam console.
  #report(line: string): void {
    if (line === this.#lastReport) return;
    this.#lastReport = line;
    this.ports.report?.(line);
  }

  async scan(): Promise<void> {
    const detectedAt = this.ports.now().toISOString();
    const warning = detectWarningSignals(
      this.ports.root,
      this.ports.currentUrl(),
    )[0];
    if (warning !== undefined) {
      this.#report(
        `[FLR] Phát hiện tín hiệu cảnh báo Facebook (${warning.reason}) — kích hoạt dừng an toàn, ngừng đọc bài.`,
      );
      if (!this.#warningSent && !this.#warningSending) {
        this.#warningSending = true;
        try {
          await this.ports.sendMessage({
            type: "WARNING_DETECTED",
            reason: warning.reason,
            detectedAt,
          });
          this.#warningSent = true;
        } finally {
          this.#warningSending = false;
        }
      }
      return;
    }

    const sends: Array<Promise<unknown>> = [];
    let articleCount = 0;
    let failureCount = 0;
    let freshSendCount = 0;
    // P6.8: đếm theo MÃ lỗi trích xuất (missing_permalink, missing_text...)
    // để dòng chẩn đoán chỉ đích danh tầng hỏng, không phải đoán.
    const failureCodes = new Map<string, number>();
    for (const article of findPostElements(this.ports.root)) {
      articleCount += 1;
      const result = extractPost(article, {
        currentUrl: this.ports.currentUrl(),
        seenAt: detectedAt,
      });
      if (isExtractionFailure(result)) {
        failureCount += 1;
        failureCodes.set(result.code, (failureCodes.get(result.code) ?? 0) + 1);
        if (!this.#failed.has(article)) {
          this.#failed.add(article);
          sends.push(
            this.ports.sendMessage({
              type: "EXTRACTION_FAILED",
              code: result.code,
            }),
          );
        }
        continue;
      }
      this.#articles.set(result.postKey, article);
      // Bug 2026-07-20: bài "người tham gia ẩn danh" lúc đầu hiện dạng rút
      // gọn (chưa có nội dung) trong feed — Facebook chỉ hiện đủ nội dung
      // sau khi người dùng bấm mở bài. Nếu chỉ nhớ "đã gửi hay chưa" (có/
      // không), bài sẽ bị khoá vĩnh viễn ở lần quét đầu (nội dung rỗng) và
      // không bao giờ gửi lại dù nội dung đầy đủ đã hiển thị. Thay vào đó,
      // nhớ NỘI DUNG đã gửi lần trước — chỉ bỏ qua khi nội dung không đổi.
      const previousText = this.#sentText.get(result.postKey);
      if (previousText === result.text || this.#sending.has(result.postKey)) {
        continue;
      }
      this.#sending.add(result.postKey);
      freshSendCount += 1;
      sends.push(
        this.ports
          .sendMessage({ type: "POST_SEEN", post: result })
          .then(() => this.#sentText.set(result.postKey, result.text))
          .finally(() => this.#sending.delete(result.postKey)),
      );
    }
    await Promise.all(sends);
    const failureDetail =
      failureCodes.size === 0
        ? ""
        : ` (${[...failureCodes.entries()]
            .map(([code, count]) => `${code}×${String(count)}`)
            .join(", ")})`;
    this.#report(
      `[FLR] Quét: thấy ${String(articleCount)} bài, gửi mới ${String(freshSendCount)}, lỗi trích xuất ${String(failureCount)}${failureDetail}.`,
    );
  }

  handleMessage(input: unknown): void {
    const parsed = ExtensionMessageSchema.safeParse(input);
    if (!parsed.success || parsed.data.type !== "POST_SCORE_UPDATED") return;
    const article = this.#articles.get(parsed.data.postKey);
    if (article === undefined) return;
    this.#renderBadge(article, parsed.data.score, parsed.data.status);
  }

  #renderBadge(article: Element, score: number, status: LeadStatus): void {
    let root = this.#badgeRoots.get(article);
    if (root === undefined) {
      const host = article.ownerDocument.createElement("span");
      host.setAttribute("data-flr-score-badge", "");
      article.prepend(host);
      root = host.attachShadow({ mode: "open" });
      this.#badgeRoots.set(article, root);
    }
    const text = badgeText(score, status);
    root.replaceChildren();
    const style = article.ownerDocument.createElement("style");
    style.textContent = `span{display:inline-flex;margin:6px;padding:4px 8px;border-radius:999px;background:#175cd3;color:white;font:600 12px/1.2 system-ui;box-shadow:0 2px 8px rgb(16 24 40/.18)}`;
    const label = article.ownerDocument.createElement("span");
    label.textContent = text;
    label.setAttribute("aria-label", text);
    root.append(style, label);
  }
}
