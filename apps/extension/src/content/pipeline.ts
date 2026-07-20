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
}

const badgeText = (score: number, status: LeadStatus): string => {
  if (status === "filtered_out") return "FL · Đã lọc";
  if (status === "below_threshold") return `FL · ${score} · Dưới ngưỡng`;
  if (status === "detected") return "FL · Đang xử lý";
  return `FL · ${score} điểm`;
};

export class ContentScanner {
  readonly #sent = new Set<string>();
  readonly #sending = new Set<string>();
  readonly #failed = new WeakSet<Element>();
  readonly #articles = new Map<string, Element>();
  readonly #badgeRoots = new WeakMap<Element, ShadowRoot>();
  #warningSent = false;
  #warningSending = false;

  constructor(private readonly ports: ContentScannerPorts) {}

  async scan(): Promise<void> {
    const detectedAt = this.ports.now().toISOString();
    const warning = detectWarningSignals(
      this.ports.root,
      this.ports.currentUrl(),
    )[0];
    if (warning !== undefined) {
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
    for (const article of findPostElements(this.ports.root)) {
      const result = extractPost(article, {
        currentUrl: this.ports.currentUrl(),
        seenAt: detectedAt,
      });
      if (isExtractionFailure(result)) {
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
      if (this.#sent.has(result.postKey) || this.#sending.has(result.postKey)) {
        continue;
      }
      this.#sending.add(result.postKey);
      sends.push(
        this.ports
          .sendMessage({ type: "POST_SEEN", post: result })
          .then(() => this.#sent.add(result.postKey))
          .finally(() => this.#sending.delete(result.postKey)),
      );
    }
    await Promise.all(sends);
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
