import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { extractPost, findPostElements, isExtractionFailure } from "./index";

// P6.12: bài viết kiểu MỚI (P6.9) không còn role="article" trên chính nó —
// chỉ là <div> thường, con trực tiếp của [role="feed"]. Trước bản vá này,
// fallback dir=auto (SELECTORS.message[2]) vẫn đòi hỏi tổ tiên role="article"
// nên không tìm thấy gì trên đúng các bài kiểu mới này (missing_text), dù
// permalink đã trích xuất đúng qua comment lồng bên trong (P6.10). Test này
// dựng lại đúng cấu trúc DOM đã xác nhận trên Facebook thật (file DUC lưu lại
// 2026-07-22): bài kiểu mới, có vài đoạn dir=auto trang trí rỗng nghĩa xen
// giữa (Facebook tự chèn), và một bình luận lồng bên trong mang permalink.

const seenAt = "2026-07-22T10:00:00+07:00";

const documentFrom = (html: string): Document => {
  const window = new Window({ url: "https://www.facebook.com/" });
  window.document.write(html);
  return window.document as unknown as Document;
};

describe("extractPost trên bài viết kiểu mới (feed > div, không role=article)", () => {
  const newStylePostHtml = `
    <div role="feed">
      <div>
        <span dir="auto">Facebook</span>
        <h2><a role="link" href="/profile.php?id=123">Tac Gia Test</a></h2>
        <span dir="auto">Facebook</span>
        <div dir="auto">Cần tìm freelancer thiết kế logo gấp, ngân sách 2 triệu, inbox mình nhé.</div>
        <span dir="auto">Facebook</span>
        <div role="article" aria-label="Bình luận của Người Khác">
          <a href="/groups/1/posts/5/"><span dir="auto">2 giờ</span></a>
          <div dir="auto">Bình luận của người khác, không phải nội dung bài viết chính.</div>
        </div>
        <span dir="auto">Facebook</span>
      </div>
    </div>
  `;

  it("chỉ tìm thấy đúng 1 bài cấp cao nhất, không lẫn comment lồng bên trong", () => {
    const document = documentFrom(newStylePostHtml);
    const posts = findPostElements(document);
    expect(posts).toHaveLength(1);
  });

  it("trích xuất đúng permalink (từ comment lồng, theo P6.10) và đúng text bài viết, không lẫn rác trang trí hay nội dung comment", () => {
    const document = documentFrom(newStylePostHtml);
    const [post] = findPostElements(document);
    if (post === undefined) throw new Error("Không tìm thấy bài viết");

    const result = extractPost(post, { seenAt });
    expect(isExtractionFailure(result)).toBe(false);
    expect(result).toMatchObject({
      postKey: "1:5",
      authorName: "Tac Gia Test",
      text: "Cần tìm freelancer thiết kế logo gấp, ngân sách 2 triệu, inbox mình nhé.",
    });
    if (!isExtractionFailure(result)) {
      expect(result.text).not.toContain("Facebook");
      expect(result.text).not.toContain("Bình luận của người khác");
    }
  });

  it("bài kiểu CŨ (role=article) vẫn hoạt động y hệt sau khi đơn giản hoá selector fallback", () => {
    const html = `<article role="article">
      <h2><a href="/fake/"><span dir="auto">Tac Gia Fake</span></a></h2>
      <a href="/groups/1/posts/9/"><span dir="auto">1 giờ</span></a>
      <div dir="auto">Cần freelancer thiết kế bộ nhận diện thương hiệu.</div>
    </article>`;
    const document = documentFrom(html);
    const article = document.querySelector('[role="article"]');
    if (article === null) throw new Error("Fixture thiếu article");
    expect(extractPost(article, { seenAt })).toMatchObject({
      postKey: "1:9",
      text: "Cần freelancer thiết kế bộ nhận diện thương hiệu.",
    });
  });
});
