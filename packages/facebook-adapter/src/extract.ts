import { RawPostSchema, type RawPost } from "@flr/shared";
import { SELECTORS } from "./selectors";
import {
  parseGroupIdFromUrl,
  parsePostReference,
  type ParsedPostReference,
} from "./urls";

const FACEBOOK_ORIGIN = "https://www.facebook.com";

export type ExtractionFailureCode =
  "invalid_element" | "missing_permalink" | "missing_text" | "invalid_post";

export interface ExtractionFailure {
  ok: false;
  code: ExtractionFailureCode;
  detail?: string;
}

export interface ExtractPostOptions {
  seenAt?: string;
  currentUrl?: string;
}

export type ExtractPostResult = RawPost | ExtractionFailure;

const failure = (
  code: ExtractionFailureCode,
  detail?: string,
): ExtractionFailure => ({ ok: false, code, ...(detail ? { detail } : {}) });

export const isExtractionFailure = (
  value: ExtractPostResult,
): value is ExtractionFailure => "ok" in value && value.ok === false;

const normalizeText = (value: string): string =>
  value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const belongsToArticle = (node: Element, article: Element): boolean =>
  node.closest(SELECTORS.post) === article;

// Bug 2026-07-21 (xác nhận qua DevTools thật): Facebook gắn role="article"
// cho MỖI BÌNH LUẬN trong luồng bình luận, không chỉ cho bài đăng gốc — và
// khối bình luận này KHÔNG nằm lồng trong role="article" của chính bài đăng
// (Facebook dựng phần bình luận thành một nhánh DOM riêng), nên bộ lọc "loại
// bài lồng nhau" bên dưới không bắt được. Facebook tự gắn aria-label bắt đầu
// bằng "Bình luận..." (hoặc "Comment..." nếu tài khoản dùng tiếng Anh) cho
// đúng các phần tử này — dùng chính nhãn đó của Facebook để loại bình luận ra
// khỏi danh sách bài đăng, tránh đưa nội dung bình luận (thường là người khác
// tự quảng cáo dịch vụ của họ) vào chấm điểm như thể là một bài đăng thật.
const COMMENT_ARIA_LABEL_PREFIXES = ["bình luận", "comment"];

const isCommentArticle = (article: Element): boolean => {
  const label = article.getAttribute("aria-label");
  if (label === null) return false;
  const normalized = label.trim().toLowerCase();
  return COMMENT_ARIA_LABEL_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
};

// P6.10 (xác nhận trên Facebook thật, cùng DUC, 2026-07-21): bài viết hiện tại
// không còn để lộ link "địa chỉ cố định" ngay trên chính nó (dòng thời gian
// không có href) — link permalink chỉ còn xuất hiện trong DOM của MỘT COMMENT
// lồng bên trong (thời gian riêng của comment đó luôn trỏ ngược về đúng bài
// viết cha, kèm mã comment). Link đó vẫn đúng bài, chỉ là nằm trong subtree
// của comment nên `belongsToArticle` (yêu cầu khớp CHÍNH XÁC article) từ chối
// nhầm nó. KHÁC HẲN trường hợp bài CHIA SẺ LỒNG BÊN TRONG (P3) — đó là một
// bài viết ĐỘC LẬP khác, phải tiếp tục bị bỏ qua. Chỉ nới lỏng cho đúng một
// trường hợp: chủ sở hữu gần nhất là COMMENT (không phải bài chia sẻ) —
// CHỈ dùng cho việc tìm permalink; text/author/timestamp vẫn dùng
// `belongsToArticle` nghiêm ngặt như cũ để không lấy nhầm nội dung của comment.
const belongsToArticleOrNestedComment = (
  node: Element,
  article: Element,
): boolean => {
  const owner = node.closest(SELECTORS.post);
  if (owner === article) return true;
  return owner !== null && isCommentArticle(owner);
};

const ownedMatches = (
  article: Element,
  selectors: readonly string[],
): Element[] => {
  for (const selector of selectors) {
    const matches = [...article.querySelectorAll(selector)].filter((node) =>
      belongsToArticle(node, article),
    );
    if (matches.length > 0) return matches;
  }
  return [];
};

const textFromElements = (elements: readonly Element[]): string =>
  normalizeText(
    elements
      .map((element) => {
        const clone = element.cloneNode(true) as Element;
        for (const button of clone.querySelectorAll(SELECTORS.button)) {
          if (
            /^(?:xem thêm|see more)$/i.test(
              normalizeText(button.textContent ?? ""),
            )
          ) {
            button.remove();
          }
        }
        return clone.textContent ?? "";
      })
      .filter(Boolean)
      .join("\n"),
  );

const getMessageElements = (article: Element): Element[] => {
  const stable = ownedMatches(article, SELECTORS.message.slice(0, 2));
  if (stable.length > 0) return stable;

  const fallback = ownedMatches(article, [SELECTORS.message[2]]).filter(
    (element) =>
      element.closest("a, button, h1, h2, h3") === null &&
      !element.matches(SELECTORS.commentBox.join(",")) &&
      normalizeText(element.textContent ?? "").length > 0,
  );
  return fallback
    .sort(
      (left, right) =>
        normalizeText(right.textContent ?? "").length -
        normalizeText(left.textContent ?? "").length,
    )
    .slice(0, 1);
};

const extractReference = (
  article: Element,
  currentUrl?: string,
): ParsedPostReference | null => {
  if (currentUrl !== undefined) {
    const currentReference = parsePostReference(currentUrl);
    if (currentReference !== null) return currentReference;
  }
  for (const link of article.querySelectorAll<HTMLAnchorElement>(
    SELECTORS.link,
  )) {
    if (!belongsToArticleOrNestedComment(link, article)) continue;
    const reference = parsePostReference(link.href);
    if (reference !== null) return reference;
  }
  return null;
};

const getAuthor = (
  article: Element,
): {
  authorName?: string;
  authorProfileUrl?: string;
  anonymousPoster: boolean;
} => {
  const authorElement = ownedMatches(article, SELECTORS.author)[0];
  const authorName = normalizeText(authorElement?.textContent ?? "");
  const anonymousPoster =
    /^(?:người tham gia ẩn danh|anonymous participant)$/i.test(authorName);
  if (authorName.length === 0 || anonymousPoster) return { anonymousPoster };

  const href = authorElement?.getAttribute("href");
  let authorProfileUrl: string | undefined;
  if (href !== null && href !== undefined) {
    try {
      const url = new URL(href, "https://www.facebook.com");
      if (url.protocol === "https:" && url.hostname === "www.facebook.com") {
        url.search = "";
        url.hash = "";
        authorProfileUrl = url.toString();
      }
    } catch {
      authorProfileUrl = undefined;
    }
  }
  return {
    authorName,
    ...(authorProfileUrl === undefined ? {} : { authorProfileUrl }),
    anonymousPoster: false,
  };
};

const isTruncated = (article: Element): boolean =>
  [...article.querySelectorAll(SELECTORS.button)]
    .filter((node) => belongsToArticle(node, article))
    .some((node) =>
      /^(?:xem thêm|see more)$/i.test(normalizeText(node.textContent ?? "")),
    );

const getPostedAtText = (article: Element): string | undefined => {
  const element = ownedMatches(article, SELECTORS.timestamp)[0];
  const value = normalizeText(
    element?.getAttribute("aria-label") ?? element?.textContent ?? "",
  );
  return value.length === 0 ? undefined : value;
};

export const extractPost = (
  element: Element,
  options: ExtractPostOptions = {},
): ExtractPostResult => {
  try {
    if (!element.matches(SELECTORS.post)) return failure("invalid_element");

    const reference = extractReference(element, options.currentUrl);
    if (reference === null) return failure("missing_permalink");

    const text = textFromElements(getMessageElements(element));
    if (text.length === 0) return failure("missing_text");

    // Bug P6.3: nhóm phải lấy theo TRANG đang mở (khớp allowlist), không lấy
    // theo permalink bài — vì Facebook dùng số ở thanh địa chỉ nhưng tên chữ
    // trong link bài. Không có URL trang → giữ groupId của permalink (đúng
    // cho trang permalink đơn lẻ và cho fixture cũ không truyền currentUrl).
    const pageGroupId =
      options.currentUrl === undefined
        ? null
        : parseGroupIdFromUrl(options.currentUrl);
    const groupId = pageGroupId ?? reference.groupId;
    const postKey = `${groupId}:${reference.postId}`;
    const permalink =
      pageGroupId === null
        ? reference.permalink
        : `${FACEBOOK_ORIGIN}/groups/${groupId}/posts/${reference.postId}/`;

    const parsed = RawPostSchema.safeParse({
      postKey,
      groupId,
      permalink,
      ...getAuthor(element),
      text,
      truncated: isTruncated(element),
      postedAtText: getPostedAtText(element),
      seenAt: options.seenAt ?? new Date().toISOString(),
    });
    return parsed.success
      ? parsed.data
      : failure("invalid_post", parsed.error.issues[0]?.message);
  } catch (error) {
    return failure(
      "invalid_post",
      error instanceof Error ? error.message : "Lỗi trích xuất không xác định",
    );
  }
};

export const findPostElements = (root: ParentNode): Element[] => {
  try {
    return [...root.querySelectorAll(SELECTORS.post)].filter((article) => {
      if (isCommentArticle(article)) return false;
      const parentArticle = article.parentElement?.closest(SELECTORS.post);
      return parentArticle === null || parentArticle === undefined;
    });
  } catch {
    return [];
  }
};
