const FACEBOOK_ORIGIN = "https://www.facebook.com";

export interface ParsedPostReference {
  groupId: string;
  postId: string;
  postKey: string;
  permalink: string;
}

const VALID_ID = /^[A-Za-z0-9._-]{1,256}$/;

const decodePart = (value: string | undefined): string | null => {
  if (value === undefined) return null;
  try {
    const decoded = decodeURIComponent(value);
    return VALID_ID.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

const buildReference = (
  groupIdValue: string | undefined,
  postIdValue: string | undefined,
): ParsedPostReference | null => {
  const groupId = decodePart(groupIdValue);
  const postId = decodePart(postIdValue);
  if (groupId === null || postId === null || groupId.length > 128) return null;
  return {
    groupId,
    postId,
    postKey: `${groupId}:${postId}`,
    permalink: `${FACEBOOK_ORIGIN}/groups/${groupId}/posts/${postId}/`,
  };
};

export const parsePostReference = (
  urlValue: string,
): ParsedPostReference | null => {
  try {
    const url = new URL(urlValue, FACEBOOK_ORIGIN);
    if (url.protocol !== "https:" || url.hostname !== "www.facebook.com") {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (
      segments[0] === "groups" &&
      (segments[2] === "posts" || segments[2] === "permalink")
    ) {
      return buildReference(segments[1], segments[3]);
    }

    if (url.pathname === "/story.php") {
      return buildReference(
        url.searchParams.get("id") ?? undefined,
        url.searchParams.get("story_fbid") ?? undefined,
      );
    }

    if (url.pathname === "/group.php") {
      return buildReference(
        url.searchParams.get("id") ?? undefined,
        url.searchParams.get("post_id") ?? undefined,
      );
    }

    if (segments[0] === "groups" && segments[1] !== undefined) {
      return buildReference(
        segments[1],
        url.searchParams.get("multi_permalinks") ?? undefined,
      );
    }

    if (url.pathname === "/photo") {
      const set = url.searchParams.get("set") ?? "";
      const groupMatch = /^gm\.([A-Za-z0-9._-]+)$/.exec(set);
      return buildReference(
        groupMatch?.[1],
        url.searchParams.get("fbid") ?? undefined,
      );
    }
  } catch {
    return null;
  }
  return null;
};

export const parsePostKey = (url: string): string | null =>
  parsePostReference(url)?.postKey ?? null;

/**
 * Lấy định danh nhóm từ URL TRANG (thanh địa chỉ) — có thể là số
 * (`155221226781882`) hoặc tên chữ (`hoithietkedao.vn`). Dùng làm nguồn chân
 * lý cho nhóm của một bài, vì Facebook đặt nhóm bằng SỐ trên thanh địa chỉ
 * nhưng bằng TÊN CHỮ trong permalink bài viết — hai cái không bằng nhau khiến
 * khớp allowlist thất bại (bug P6.3). Quy tắc trùng khớp `extractGroupId`
 * trong apps/extension để senderGroupId === post.groupId.
 */
export const parseGroupIdFromUrl = (urlValue: string): string | null => {
  try {
    const url = new URL(urlValue, FACEBOOK_ORIGIN);
    if (url.protocol !== "https:" || url.hostname !== "www.facebook.com") {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "groups" || parts[1] === undefined) return null;
    return /^[A-Za-z0-9._-]{1,128}$/.test(parts[1]) ? parts[1] : null;
  } catch {
    return null;
  }
};
