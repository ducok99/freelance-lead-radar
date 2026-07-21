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
  // P6.7: modal XEM BÀI VIẾT của Facebook cũng là role="dialog" và chứa toàn
  // bộ nội dung bài + bình luận. Nếu gộp text của nó vào "văn bản cảnh báo",
  // một bình luận vô hại (vd "bạn thử lại sau nhé") sẽ kích hoạt dừng an toàn
  // giả — và toàn pipeline chết im lặng. Hộp cảnh báo thật của Facebook không
  // bao giờ chứa bài viết bên trong, nên: dialog/alert nào chứa role=article
  // thì bỏ qua khi gom văn bản cảnh báo.
  const explicitWarnings = [...root.querySelectorAll(SELECTORS.warning)]
    .filter((element) => element.querySelector(SELECTORS.post) === null)
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
    // P6.7: bỏ cụm "thử lại sau"/"try again later" đứng một mình — đây là câu
    // cửa miệng trong toast lỗi thường ngày của Facebook (nhất là khi có ad
    // blocker chặn request), từng gây BÁO ĐỘNG GIẢ ngắt cầu dao trên trang
    // hoàn toàn bình thường. Giữ nguyên mọi cụm đặc hiệu của màn chặn thật và
    // bổ sung cụm rate-limit đặc hiệu "thao tác quá nhanh" — bảo vệ thật
    // không yếu đi.
    if (
      /(?:bạn tạm thời bị chặn|you're temporarily blocked|you are temporarily blocked|thao tác quá nhanh|going too fast)/i.test(
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
