import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import blockedHtml from "../../../fixtures/facebook/blocked-banner.html?raw";
import blockedMeta from "../../../fixtures/facebook/blocked-banner.meta.json";
import captchaHtml from "../../../fixtures/facebook/captcha.html?raw";
import captchaMeta from "../../../fixtures/facebook/captcha.meta.json";
import checkpointHtml from "../../../fixtures/facebook/checkpoint.html?raw";
import checkpointMeta from "../../../fixtures/facebook/checkpoint.meta.json";
import textHtml from "../../../fixtures/facebook/text-post.html?raw";
import { detectWarningSignals } from "./index";

const documentFrom = (html: string, url: string): Document => {
  const window = new Window({ url });
  window.document.write(html);
  return window.document as unknown as Document;
};

describe("detectWarningSignals", () => {
  it.each([
    [checkpointHtml, checkpointMeta],
    [captchaHtml, captchaMeta],
    [blockedHtml, blockedMeta],
  ] as const)("nhận diện fixture $1.variant", (html, meta) => {
    expect(
      detectWarningSignals(
        documentFrom(html, meta.currentUrl),
        meta.currentUrl,
      ).map((signal) => signal.reason),
    ).toEqual(meta.expectedWarnings);
  });

  it("nhận diện redirect về login", () => {
    const url = "https://www.facebook.com/login.php?next=%2Fgroups%2F1";
    expect(
      detectWarningSignals(documentFrom("<main></main>", url), url),
    ).toEqual([{ reason: "login_redirect", evidence: "url" }]);
  });

  it("feed bình thường không có cảnh báo", () => {
    const url = "https://www.facebook.com/groups/100000000000001/";
    expect(detectWarningSignals(documentFrom(textHtml, url), url)).toEqual([]);
  });

  it("không hiểu nhầm nội dung bài viết có câu thử lại sau", () => {
    const html = `<article role="article"><div data-ad-preview="message">Bạn có thể thử lại sau khi sửa brief.</div></article>`;
    expect(detectWarningSignals(documentFrom(html, url), url)).toEqual([]);
  });

  it("nhận diện cảnh báo giới hạn chung trong role alert", () => {
    const html = `<div role="alert">Chúng tôi đã giới hạn một số hoạt động trên tài khoản.</div>`;
    expect(detectWarningSignals(documentFrom(html, url), url)).toEqual([
      { reason: "facebook_warning", evidence: "text" },
    ]);
  });

  it("không nhận URL checkpoint của host khác", () => {
    const maliciousUrl = "https://example.com/checkpoint/123";
    expect(
      detectWarningSignals(
        documentFrom("<main></main>", maliciousUrl),
        maliciousUrl,
      ),
    ).toEqual([]);
  });

  it("không kết luận cảnh báo chỉ vì URL rác", () => {
    expect(
      detectWarningSignals(documentFrom("<main></main>", url), "%%%"),
    ).toEqual([]);
  });

  it("DOM throw trả unknown_warning thay vì throw", () => {
    const brokenRoot = {
      querySelector: () => {
        throw new Error("DOM lỗi");
      },
    } as unknown as ParentNode;
    expect(detectWarningSignals(brokenRoot, url)).toEqual([
      { reason: "unknown_warning", evidence: "dom" },
    ]);
  });
});

const url = "https://www.facebook.com/";
