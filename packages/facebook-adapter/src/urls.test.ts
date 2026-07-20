import { describe, expect, it } from "vitest";
import { parsePostKey, parsePostReference } from "./index";

const groupId = "100000000000001";

describe("parsePostKey", () => {
  it.each([
    [
      `https://www.facebook.com/groups/${groupId}/posts/200000000000001/`,
      `${groupId}:200000000000001`,
    ],
    [
      `/groups/${groupId}/permalink/200000000000002/?tracking=removed`,
      `${groupId}:200000000000002`,
    ],
    [
      `https://www.facebook.com/story.php?story_fbid=200000000000003&id=${groupId}`,
      `${groupId}:200000000000003`,
    ],
    [
      `https://www.facebook.com/groups/${groupId}/posts/pfbid0FakePostId_01/`,
      `${groupId}:pfbid0FakePostId_01`,
    ],
    [
      `https://www.facebook.com/group.php?view=permalink&id=${groupId}&post_id=200000000000005`,
      `${groupId}:200000000000005`,
    ],
    [
      `https://www.facebook.com/groups/${groupId}/?multi_permalinks=200000000000006`,
      `${groupId}:200000000000006`,
    ],
    [
      `https://www.facebook.com/photo?fbid=200000000000007&set=gm.${groupId}`,
      `${groupId}:200000000000007`,
    ],
  ])("đọc dạng URL %s", (url, expected) => {
    expect(parsePostKey(url)).toBe(expected);
  });

  it.each([
    "https://example.com/groups/1/posts/2/",
    "http://www.facebook.com/groups/1/posts/2/",
    "https://facebook.com/groups/1/posts/2/",
    "https://www.facebook.com/groups/1/",
    "not a url",
    "https://www.facebook.com/story.php?id=1",
    "https://www.facebook.com/groups/%E0%A4%A/posts/2/",
  ])("từ chối URL không hợp lệ: %s", (url) => {
    expect(parsePostKey(url)).toBeNull();
  });

  it("trả canonical permalink không có tracking", () => {
    expect(
      parsePostReference(
        `https://www.facebook.com/groups/${groupId}/permalink/200000000000008/?__cft__=secret`,
      ),
    ).toEqual({
      groupId,
      postId: "200000000000008",
      postKey: `${groupId}:200000000000008`,
      permalink: `https://www.facebook.com/groups/${groupId}/posts/200000000000008/`,
    });
  });
});
