import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import anonymousHtml from "../../../fixtures/facebook/anonymous-post.html?raw";
import anonymousMeta from "../../../fixtures/facebook/anonymous-post.meta.json";
import contactHtml from "../../../fixtures/facebook/contact-post.html?raw";
import contactMeta from "../../../fixtures/facebook/contact-post.meta.json";
import imageHtml from "../../../fixtures/facebook/image-post.html?raw";
import imageMeta from "../../../fixtures/facebook/image-post.meta.json";
import layoutWeirdHtml from "../../../fixtures/facebook/layout-weird.html?raw";
import layoutWeirdMeta from "../../../fixtures/facebook/layout-weird.meta.json";
import mixedFeedHtml from "../../../fixtures/facebook/mixed-feed.html?raw";
import mixedFeedMeta from "../../../fixtures/facebook/mixed-feed.meta.json";
import permalinkHtml from "../../../fixtures/facebook/permalink-comment.html?raw";
import permalinkMeta from "../../../fixtures/facebook/permalink-comment.meta.json";
import sharedHtml from "../../../fixtures/facebook/shared-post.html?raw";
import sharedMeta from "../../../fixtures/facebook/shared-post.meta.json";
import textHtml from "../../../fixtures/facebook/text-post.html?raw";
import textMeta from "../../../fixtures/facebook/text-post.meta.json";
import truncatedHtml from "../../../fixtures/facebook/truncated-post.html?raw";
import truncatedMeta from "../../../fixtures/facebook/truncated-post.meta.json";
import { extractPost, findPostElements, isExtractionFailure } from "./index";

const seenAt = "2026-07-20T13:30:00+07:00";

const documentFrom = (
  html: string,
  url = "https://www.facebook.com/",
): Document => {
  const window = new Window({ url });
  window.document.write(html);
  return window.document as unknown as Document;
};

const singleArticle = (html: string, url?: string): Element => {
  const article = documentFrom(html, url).querySelector('[role="article"]');
  if (article === null) throw new Error("Fixture thiếu article");
  return article;
};

const standardFixtures = [
  ["text", textHtml, textMeta],
  ["truncated", truncatedHtml, truncatedMeta],
  ["anonymous", anonymousHtml, anonymousMeta],
  ["image", imageHtml, imageMeta],
  ["shared", sharedHtml, sharedMeta],
  ["contact", contactHtml, contactMeta],
] as const;

describe("extractPost", () => {
  it.each(standardFixtures)("extract fixture %s", (_name, html, meta) => {
    const result = extractPost(singleArticle(html), { seenAt });
    expect(isExtractionFailure(result)).toBe(false);
    expect(result).toMatchObject({ ...meta.expected, seenAt });
  });

  it("dùng URL trang hiện tại khi permalink không có anchor", () => {
    const result = extractPost(
      singleArticle(permalinkHtml, permalinkMeta.currentUrl),
      { seenAt, currentUrl: permalinkMeta.currentUrl },
    );
    expect(result).toMatchObject({ ...permalinkMeta.expected, seenAt });
  });

  it("không lấy text/link của bài share lồng", () => {
    const document = documentFrom(sharedHtml);
    expect(findPostElements(document)).toHaveLength(1);
    const result = extractPost(findPostElements(document)[0]!, { seenAt });
    expect(result).toMatchObject(sharedMeta.expected);
    expect(JSON.stringify(result)).not.toContain("299999999999999");
  });

  it("feed 10 article chỉ extract 4 bài có permalink", () => {
    const articles = findPostElements(documentFrom(mixedFeedHtml));
    const results = articles.map((article) => extractPost(article, { seenAt }));
    const postKeys = results.flatMap((result) =>
      isExtractionFailure(result) ? [] : [result.postKey],
    );
    const failures = results.filter(isExtractionFailure);
    expect(articles).toHaveLength(mixedFeedMeta.expectedArticleCount);
    expect(postKeys).toEqual(mixedFeedMeta.expectedPostKeys);
    expect(failures).toHaveLength(mixedFeedMeta.expectedFailureCount);
  });

  it("layout cắt xén trả failure có mã, không throw", () => {
    expect(() =>
      extractPost(singleArticle(layoutWeirdHtml), { seenAt }),
    ).not.toThrow();
    expect(extractPost(singleArticle(layoutWeirdHtml), { seenAt })).toEqual({
      ok: false,
      code: layoutWeirdMeta.expectedFailure,
    });
  });

  it("element không phải article bị từ chối", () => {
    const body = documentFrom(
      "<body><div>Không phải bài viết</div></body>",
    ).body;
    expect(extractPost(body, { seenAt })).toEqual({
      ok: false,
      code: "invalid_element",
    });
  });

  it("bài không có text trả missing_text", () => {
    const html = `<article role="article"><a href="/groups/1/posts/2/">link</a></article>`;
    expect(extractPost(singleArticle(html), { seenAt })).toEqual({
      ok: false,
      code: "missing_text",
    });
  });

  it("fallback dir=auto bỏ author/time và lấy khối nội dung dài nhất", () => {
    const html = `<article role="article">
      <h2><a href="/fake/"><span dir="auto">Tac Gia Fake</span></a></h2>
      <a href="/groups/1/posts/3/"><span dir="auto">1 giờ</span></a>
      <div dir="auto">Cần freelancer thiết kế bộ nhận diện thương hiệu.</div>
    </article>`;
    expect(extractPost(singleArticle(html), { seenAt })).toMatchObject({
      postKey: "1:3",
      text: "Cần freelancer thiết kế bộ nhận diện thương hiệu.",
    });
  });

  it("không đưa nút Xem thêm lồng trong message vào nội dung", () => {
    const html = `<article role="article">
      <a href="/groups/1/posts/4/">1 giờ</a>
      <div data-ad-preview="message">Nội dung đang bị rút gọn <button>Xem thêm</button></div>
    </article>`;
    expect(extractPost(singleArticle(html), { seenAt })).toMatchObject({
      text: "Nội dung đang bị rút gọn",
      truncated: true,
    });
  });

  it("seenAt sai trả invalid_post thay vì throw", () => {
    const result = extractPost(singleArticle(textHtml), { seenAt: "sai" });
    expect(result).toMatchObject({ ok: false, code: "invalid_post" });
  });

  it("DOM throw trả invalid_post", () => {
    const brokenElement = {
      matches: () => {
        throw new Error("DOM lỗi");
      },
    } as unknown as Element;
    expect(extractPost(brokenElement, { seenAt })).toEqual({
      ok: false,
      code: "invalid_post",
      detail: "DOM lỗi",
    });
  });

  it("findPostElements trả mảng rỗng khi DOM throw", () => {
    const brokenRoot = {
      querySelectorAll: () => {
        throw new Error("DOM lỗi");
      },
    } as unknown as ParentNode;
    expect(findPostElements(brokenRoot)).toEqual([]);
  });
});
