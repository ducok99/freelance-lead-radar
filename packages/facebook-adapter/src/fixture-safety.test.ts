import { describe, expect, it } from "vitest";
import anonymousHtml from "../../../fixtures/facebook/anonymous-post.html?raw";
import blockedHtml from "../../../fixtures/facebook/blocked-banner.html?raw";
import captchaHtml from "../../../fixtures/facebook/captcha.html?raw";
import checkpointHtml from "../../../fixtures/facebook/checkpoint.html?raw";
import contactHtml from "../../../fixtures/facebook/contact-post.html?raw";
import imageHtml from "../../../fixtures/facebook/image-post.html?raw";
import layoutWeirdHtml from "../../../fixtures/facebook/layout-weird.html?raw";
import mixedFeedHtml from "../../../fixtures/facebook/mixed-feed.html?raw";
import permalinkHtml from "../../../fixtures/facebook/permalink-comment.html?raw";
import sharedHtml from "../../../fixtures/facebook/shared-post.html?raw";
import textHtml from "../../../fixtures/facebook/text-post.html?raw";
import truncatedHtml from "../../../fixtures/facebook/truncated-post.html?raw";

const fixtures = [
  anonymousHtml,
  blockedHtml,
  captchaHtml,
  checkpointHtml,
  contactHtml,
  imageHtml,
  layoutWeirdHtml,
  mixedFeedHtml,
  permalinkHtml,
  sharedHtml,
  textHtml,
  truncatedHtml,
];

describe("fixture Facebook đã làm sạch", () => {
  it("không chứa số điện thoại thật 10 chữ số", () => {
    expect(fixtures.join("\n")).not.toMatch(/\b0\d{9}\b/);
  });

  it("không chứa tracking, cookie, session hoặc token", () => {
    expect(fixtures.join("\n")).not.toMatch(
      /(?:__cft__|fbclid|access[_-]?token|document\.cookie|sessionid)/i,
    );
  });

  it("email fixture chỉ dùng miền dành cho test", () => {
    const emails =
      fixtures.join("\n").match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
    expect(emails).toEqual(["user@example.test"]);
  });

  it("không chứa URL ảnh/remote Facebook", () => {
    expect(fixtures.join("\n")).not.toMatch(
      /https:\/\/(?:[^/]+\.)?(?:facebook|fbcdn)\.(?:com|net)/i,
    );
  });
});
