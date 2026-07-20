import { SELECTORS } from "./selectors";

const COMMENT_LABEL =
  /^(?:(?:viết )?bình luận(?: dưới tên .+)?|write a comment|comment as .+)$/i;

const isCommentBox = (element: Element): element is HTMLElement => {
  if (!(element instanceof element.ownerDocument.defaultView!.HTMLElement)) {
    return false;
  }
  const label = [
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.getAttribute("data-placeholder"),
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
  return COMMENT_LABEL.test(label);
};

export const findCommentBox = (root: ParentNode): HTMLElement | null => {
  try {
    for (const selector of SELECTORS.commentBox) {
      const match = [...root.querySelectorAll(selector)].find(isCommentBox);
      if (match !== undefined) return match;
    }
  } catch {
    return null;
  }
  return null;
};
