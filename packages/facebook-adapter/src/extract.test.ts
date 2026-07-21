import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import anonymousHtml from "../../../fixtures/facebook/anonymous-post.html?raw";
import anonymousMeta from "../../../fixtures/facebook/anonymous-post.meta.json";
import contactHtml from "../../../fixtures/facebook/contact-post.html?raw";
import contactMeta from "../../../fixtures/facebook/contact-post.meta.json";
import feedNoArticleRoleHtml from "../../../fixtures/facebook/feed-no-article-role.html?raw";
import feedNoArticleRoleMeta from "../../../fixtures/facebook/feed-no-article-role.meta.json";
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

  it("bug P6.3: nhóm lấy theo URL trang (số) khi permalink dùng tên chữ", () => {
    // Trang mở bằng groupId số; permalink bài lại dùng slug hoithietkedao.vn.
    const pageUrl = "https://www.facebook.com/groups/155221226781882/";
    const html = `<article role="article">
      <a href="https://www.facebook.com/groups/hoithietkedao.vn/posts/1779708656608420/?__cft__[0]=abc&__tn__=x"><span dir="auto">2 giờ</span></a>
      <div data-ad-preview="message">Cần thuê 1 bạn thiết kế logo + banner, có ngân sách.</div>
    </article>`;
    const result = extractPost(singleArticle(html, pageUrl), {
      seenAt,
      currentUrl: pageUrl,
    });
    expect(isExtractionFailure(result)).toBe(false);
    expect(result).toMatchObject({
      groupId: "155221226781882",
      postKey: "155221226781882:1779708656608420",
      permalink:
        "https://www.facebook.com/groups/155221226781882/posts/1779708656608420/",
    });
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

  it("bug 2026-07-21: bỏ qua bình luận có role=article (không lồng trong bài đăng), không lấy nhầm thành bài đăng", () => {
    const html = `
      <article role="article">
        <h2><a role="link" href="/groups/1/">Tác giả</a></h2>
        <a href="/groups/1/posts/500/"><time>1 giờ</time></a>
        <div data-ad-preview="message">Cần thuê 1 bạn thiết kế logo, có ngân sách rõ ràng.</div>
      </article>
      <div aria-label="Bình luận dưới tên Người tham gia ẩn danh 351 vào 15 giờ trước" role="article">
        <div dir="auto">Ib zl mk nhận hỗ trợ gấp trg ngày hoặc trg buổi 0389830337</div>
      </div>
    `;
    const document = documentFrom(html);
    const elements = findPostElements(document);
    expect(elements).toHaveLength(1);
    expect(extractPost(elements[0]!, { seenAt })).toMatchObject({
      postKey: "1:500",
    });
  });

  it("bug 2026-07-21: cũng bỏ qua khi aria-label tiếng Anh 'Comment...'", () => {
    const html = `
      <article role="article">
        <a href="/groups/1/posts/501/"><time>1 giờ</time></a>
        <div data-ad-preview="message">Cần thuê 1 bạn thiết kế logo, có ngân sách rõ ràng.</div>
      </article>
      <div aria-label="Comment by Anonymous participant 12 hours ago" role="article">
        <div dir="auto">DM me for a quote 0123456789</div>
      </div>
    `;
    expect(findPostElements(documentFrom(html))).toHaveLength(1);
  });

  it("bài đăng thật có aria-label khác 'bình luận' vẫn được lấy bình thường", () => {
    const html = `
      <article role="article" aria-label="Bài viết của Tác giả">
        <a href="/groups/1/posts/502/"><time>1 giờ</time></a>
        <div data-ad-preview="message">Cần thuê 1 bạn thiết kế logo, có ngân sách rõ ràng.</div>
      </article>
    `;
    expect(findPostElements(documentFrom(html))).toHaveLength(1);
  });

  it("P6.9: Facebook hiện tại không gắn role=article cho bài viết (chỉ comment còn giữ) — vẫn nhận diện đúng nhờ bài là con trực tiếp của role=feed", () => {
    // Kiểm tra trực tiếp trên Facebook thật (2026-07-21, cùng DUC) cho thấy bài
    // viết gốc trong feed nhóm không còn role="article" — chỉ comment còn giữ.
    // Fixture này mô phỏng đúng cấu trúc đó: 2 bài viết là <div> thường (con
    // trực tiếp của role=feed), 1 bài có comment thật (role=article, aria-label
    // "Bình luận...") lồng bên trong để xác nhận comment vẫn bị loại đúng.
    const articles = findPostElements(documentFrom(feedNoArticleRoleHtml));
    expect(articles).toHaveLength(feedNoArticleRoleMeta.expectedArticleCount);
    const results = articles.map((article) => extractPost(article, { seenAt }));
    const postKeys = results.flatMap((result) =>
      isExtractionFailure(result) ? [] : [result.postKey],
    );
    expect(postKeys).toEqual(feedNoArticleRoleMeta.expectedPostKeys);
    // Bài có comment lồng bên trong không được lấy nhầm chữ/link của comment.
    const firstPost = results[0]!;
    expect(isExtractionFailure(firstPost)).toBe(false);
    expect(JSON.stringify(firstPost)).not.toContain("Mình có thể hỗ trợ");
    expect(JSON.stringify(firstPost)).not.toContain("nguyen-h-fake");
  });

  it("P6.10: bài không có link riêng vẫn lấy được permalink từ link của comment lồng bên trong (không lấy chữ của comment)", () => {
    // Phát hiện trên Facebook thật (2026-07-21): bài viết không còn để lộ link
    // "địa chỉ cố định" của chính nó — chỉ COMMENT (thời gian riêng của nó) mới
    // có link, và link đó trỏ ngược về đúng bài viết cha (kèm mã comment). Link
    // này VẪN đúng bài, khác hẳn bài CHIA SẺ LỒNG BÊN TRONG (một bài ĐỘC LẬP
    // khác, phải bỏ qua — xem test "không lấy text/link của bài share lồng").
    const html = `
      <div role="feed">
        <div>
          <h2><a role="link" href="/tran-g-fake/">Tran G.</a></h2>
          <time>3 giờ</time>
          <div data-ad-preview="message">Cần thiết kế banner sự kiện, gấp trong tuần.</div>
          <div role="article" aria-label="Bình luận dưới tên Nguyen H. vào 2 giờ trước">
            <a role="link" href="/groups/100000000000001/posts/200000000000031/?comment_id=999">2 giờ</a>
            <div>Mình có thể hỗ trợ, inbox nhé.</div>
          </div>
        </div>
      </div>
    `;
    const document = documentFrom(html);
    const elements = findPostElements(document);
    expect(elements).toHaveLength(1);
    const result = extractPost(elements[0]!, { seenAt });
    expect(isExtractionFailure(result)).toBe(false);
    expect(result).toMatchObject({
      postKey: "100000000000001:200000000000031",
    });
    expect(JSON.stringify(result)).not.toContain("Mình có thể hỗ trợ");
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
