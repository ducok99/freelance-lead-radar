import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import permalinkHtml from "../../../fixtures/facebook/permalink-comment.html?raw";
import { findCommentBox } from "./index";

const documentFrom = (html: string): Document => {
  const window = new Window({ url: "https://www.facebook.com/" });
  window.document.write(html);
  return window.document as unknown as Document;
};

describe("findCommentBox", () => {
  it("tìm ô contenteditable theo role + aria-label", () => {
    expect(
      findCommentBox(documentFrom(permalinkHtml))?.getAttribute("role"),
    ).toBe("textbox");
  });

  it("hỗ trợ textarea tiếng Anh", () => {
    expect(
      findCommentBox(
        documentFrom('<textarea aria-label="Write a comment"></textarea>'),
      )?.tagName,
    ).toBe("TEXTAREA");
  });

  it("hỗ trợ placeholder khi không có aria-label", () => {
    expect(
      findCommentBox(
        documentFrom('<textarea placeholder="Viết bình luận"></textarea>'),
      )?.tagName,
    ).toBe("TEXTAREA");
  });

  it("không nhầm textbox tìm kiếm", () => {
    expect(
      findCommentBox(
        documentFrom(
          '<div role="textbox" contenteditable="true" aria-label="Tìm kiếm"></div>',
        ),
      ),
    ).toBeNull();
  });

  it("DOM không có ô bình luận trả null", () => {
    expect(findCommentBox(documentFrom("<main></main>"))).toBeNull();
  });

  it("DOM lỗi trả null thay vì throw", () => {
    const brokenRoot = {
      querySelectorAll: () => {
        throw new Error("DOM lỗi");
      },
    } as unknown as ParentNode;
    expect(findCommentBox(brokenRoot)).toBeNull();
  });
});
