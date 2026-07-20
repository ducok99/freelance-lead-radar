import { RawPostSchema, type RawPost } from "@flr/shared";
import { SELECTORS } from "./selectors";
import { parsePostReference, type ParsedPostReference } from "./urls";

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
    if (!belongsToArticle(link, article)) continue;
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

    const parsed = RawPostSchema.safeParse({
      postKey: reference.postKey,
      groupId: reference.groupId,
      permalink: reference.permalink,
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
      const parentArticle = article.parentElement?.closest(SELECTORS.post);
      return parentArticle === null || parentArticle === undefined;
    });
  } catch {
    return [];
  }
};
