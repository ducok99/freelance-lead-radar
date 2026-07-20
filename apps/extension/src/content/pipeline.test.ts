// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { ContentScanner } from "./pipeline";

const post = (id: string, text: string) => `
  <div role="article">
    <h2><a role="link" href="https://www.facebook.com/profile.php?id=${id}">Tác giả ${id}</a></h2>
    <div data-ad-preview="message">${text}</div>
    <a href="https://www.facebook.com/groups/allowed/posts/${id}/">1 giờ</a>
  </div>`;

describe("ContentScanner P6 chỉ đọc", () => {
  it("extract các bài hiện có đúng một lần và không gửi trùng", async () => {
    document.body.innerHTML = `${post("101", "Cần thuê designer làm logo")}${post("102", "Cần bạn edit video TikTok")}`;
    const sendMessage = vi.fn(() => Promise.resolve(undefined));
    const scanner = new ContentScanner({
      root: document,
      currentUrl: () => "https://www.facebook.com/groups/allowed",
      now: () => new Date("2026-07-20T08:00:00.000Z"),
      sendMessage,
    });

    await scanner.scan();
    await scanner.scan();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "POST_SEEN" }),
    );
  });

  it("warning dừng scan bài và chỉ gửi một lần", async () => {
    document.body.innerHTML = `<div role="alert">Bạn tạm thời bị chặn, thử lại sau</div>${post("103", "Cần thuê designer")}`;
    const sendMessage = vi.fn(() => Promise.resolve(undefined));
    const scanner = new ContentScanner({
      root: document,
      currentUrl: () => "https://www.facebook.com/groups/allowed",
      now: () => new Date("2026-07-20T08:00:00.000Z"),
      sendMessage,
    });

    await scanner.scan();
    await scanner.scan();
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "WARNING_DETECTED",
        reason: "temporarily_blocked",
      }),
    );
  });

  it("thử gửi lại bài nếu background tạm thời không phản hồi", async () => {
    document.body.innerHTML = post("105", "Cần thuê designer làm logo");
    const sendMessage = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("Service worker vừa ngủ"))
      .mockResolvedValue(undefined);
    const scanner = new ContentScanner({
      root: document,
      currentUrl: () => "https://www.facebook.com/groups/allowed",
      now: () => new Date("2026-07-20T08:00:00.000Z"),
      sendMessage,
    });

    await expect(scanner.scan()).rejects.toThrow("Service worker vừa ngủ");
    await expect(scanner.scan()).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("render badge điểm trong shadow DOM, không sửa nội dung bài", async () => {
    document.body.innerHTML = post("104", "Cần thuê designer làm logo");
    const scanner = new ContentScanner({
      root: document,
      currentUrl: () => "https://www.facebook.com/groups/allowed",
      now: () => new Date("2026-07-20T08:00:00.000Z"),
      sendMessage: () => Promise.resolve(undefined),
    });
    await scanner.scan();
    scanner.handleMessage({
      type: "POST_SCORE_UPDATED",
      postKey: "allowed:104",
      score: 88,
      status: "needs_review",
    });

    const host = document.querySelector<HTMLElement>("[data-flr-score-badge]");
    expect(host?.shadowRoot?.textContent).toContain("88 điểm");
    expect(document.body.textContent).toContain("Cần thuê designer làm logo");
  });
});
