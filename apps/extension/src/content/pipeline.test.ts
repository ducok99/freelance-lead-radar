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

  it("bug 2026-07-20: gửi lại bài khi nội dung đổi (bài ẩn danh mở rộng sau khi bấm)", async () => {
    document.body.innerHTML = post("201", "Cần");
    const sendMessage = vi.fn(() => Promise.resolve(undefined));
    const scanner = new ContentScanner({
      root: document,
      currentUrl: () => "https://www.facebook.com/groups/allowed",
      now: () => new Date("2026-07-20T08:00:00.000Z"),
      sendMessage,
    });

    await scanner.scan();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        post: expect.objectContaining({ text: "Cần" }),
      }),
    );

    // Nội dung chưa đổi — quét lại không được gửi thêm lần nào (giữ hành vi
    // chống gửi trùng vốn có).
    await scanner.scan();
    expect(sendMessage).toHaveBeenCalledTimes(1);

    // Người dùng bấm mở bài ẩn danh, Facebook hiện đủ nội dung trong modal —
    // DOM đổi sang nội dung dài hơn cho cùng bài viết (cùng postKey).
    document.body.innerHTML = post(
      "201",
      "Cần thuê 1 bạn thiết kế logo + banner, có budget, cần gấp",
    );
    await scanner.scan();
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        post: expect.objectContaining({
          text: "Cần thuê 1 bạn thiết kế logo + banner, có budget, cần gấp",
        }),
      }),
    );

    // Nội dung mới cũng ổn định — quét lại lần nữa không gửi thêm.
    await scanner.scan();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("P6.7: report dòng tóm tắt quét, không lặp khi không đổi, báo cảnh báo", async () => {
    document.body.innerHTML = post("301", "Cần thuê designer làm logo");
    const lines: string[] = [];
    const scanner = new ContentScanner({
      root: document,
      currentUrl: () => "https://www.facebook.com/groups/allowed",
      now: () => new Date("2026-07-20T08:00:00.000Z"),
      sendMessage: () => Promise.resolve(undefined),
      report: (line) => lines.push(line),
    });

    await scanner.scan();
    expect(lines).toEqual([
      "[FLR] Quét: thấy 1 bài, gửi mới 1, lỗi trích xuất 0.",
    ]);

    // Quét lại: bài đã gửi rồi nên dòng đổi thành "gửi mới 0" (đúng một lần).
    await scanner.scan();
    expect(lines).toEqual([
      "[FLR] Quét: thấy 1 bài, gửi mới 1, lỗi trích xuất 0.",
      "[FLR] Quét: thấy 1 bài, gửi mới 0, lỗi trích xuất 0.",
    ]);

    // Từ đây trạng thái ổn định → không thêm dòng nào (chống spam console).
    await scanner.scan();
    expect(lines).toHaveLength(2);

    // P6.8: bài hỏng trích xuất (không có link bài) → dòng ghi rõ MÃ lỗi.
    document.body.innerHTML = `<div role="article"><div data-ad-preview="message">Cần thuê designer gấp.</div></div>`;
    await scanner.scan();
    expect(lines[2]).toBe(
      "[FLR] Quét: thấy 1 bài, gửi mới 0, lỗi trích xuất 1 (missing_permalink×1).",
    );

    // Xuất hiện cảnh báo thật → báo rõ lý do dừng.
    document.body.innerHTML = `<div role="alert">Bạn tạm thời bị chặn</div>`;
    await scanner.scan();
    expect(lines).toHaveLength(4);
    expect(lines[3]).toContain("temporarily_blocked");
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
