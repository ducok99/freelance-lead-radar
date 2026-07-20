import type { WarningReason } from "@flr/shared";
import { SELECTORS } from "./selectors";

export interface WarningSignal {
  reason: WarningReason;
  evidence: "url" | "dom" | "text";
}

const normalizedPageText = (root: ParentNode): string =>
  (root.querySelector("html")?.textContent ?? root.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const warningText = (root: ParentNode): string => {
  const explicitWarnings = [...root.querySelectorAll(SELECTORS.warning)]
    .map((element) => element.textContent ?? "")
    .join(" ");
  if (explicitWarnings.trim().length > 0) {
    return explicitWarnings.replace(/\s+/g, " ").trim().toLowerCase();
  }
  return root.querySelector(SELECTORS.post) === null
    ? normalizedPageText(root)
    : "";
};

export const detectWarningSignals = (
  root: ParentNode,
  currentUrl: string,
): WarningSignal[] => {
  const signals = new Map<WarningReason, WarningSignal>();
  const add = (reason: WarningReason, evidence: WarningSignal["evidence"]) =>
    signals.set(reason, { reason, evidence });

  try {
    const url = new URL(currentUrl, "https://www.facebook.com");
    if (
      url.protocol === "https:" &&
      url.hostname === "www.facebook.com" &&
      /^\/checkpoint(?:\/|$)/i.test(url.pathname)
    ) {
      add("checkpoint_detected", "url");
    }
    if (
      url.protocol === "https:" &&
      url.hostname === "www.facebook.com" &&
      /^\/login(?:\/|\.php|$)/i.test(url.pathname)
    ) {
      add("login_redirect", "url");
    }
  } catch {
    // URL lạ không đủ để kết luận Facebook đang cảnh báo.
  }

  try {
    if (
      SELECTORS.captcha.some(
        (selector) => root.querySelector(selector) !== null,
      )
    ) {
      add("captcha_detected", "dom");
    }
    const text = warningText(root);
    if (
      /(?:bạn tạm thời bị chặn|you're temporarily blocked|you are temporarily blocked|thử lại sau|try again later)/i.test(
        text,
      )
    ) {
      add("temporarily_blocked", "text");
    }
    if (
      /(?:chúng tôi đã giới hạn|we restrict certain activity|cảnh báo từ facebook|facebook warning)/i.test(
        text,
      )
    ) {
      add("facebook_warning", "text");
    }
  } catch {
    add("unknown_warning", "dom");
  }

  return [...signals.values()];
};
