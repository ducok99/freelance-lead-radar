/**
 * Selector chỉ dựa trên role, aria và thuộc tính ngữ nghĩa. Không thêm class
 * Facebook đã obfuscate vào đây vì chúng thay đổi liên tục.
 */
export const SELECTORS = {
  // P6.9: kiểm tra trực tiếp trên Facebook thật (2026-07-21) cho thấy bài viết
  // gốc trong feed nhóm KHÔNG còn mang role="article" nữa — chỉ COMMENT còn
  // giữ role này (đã xử lý ở P6.5). Bài viết gốc giờ chỉ là <div> thường,
  // nhưng luôn là CON TRỰC TIẾP của khung role="feed". Giữ nguyên nhánh
  // role="article" cũ (comment vẫn cần nó; trang xem 1 bài hoặc bản Facebook
  // khác có thể vẫn dùng) và thêm nhánh mới. Selector CSS hỗ trợ tổ hợp ">"
  // nên .closest()/.matches() ở extract.ts hoạt động đúng luôn, không cần sửa
  // logic xác định "thuộc về bài nào" ở nơi khác.
  post: '[role="article"], [role="feed"] > div',
  feed: '[role="feed"]',
  message: [
    '[data-ad-preview="message"]',
    '[data-testid="post_message"]',
    '[role="article"] [dir="auto"]',
  ],
  author: ['h2 a[role="link"]', 'h3 a[role="link"]', 'strong a[role="link"]'],
  timestamp: ["time", "abbr", 'a[role="link"] span[aria-label]'],
  link: "a[href]",
  button: '[role="button"], button',
  commentBox: [
    '[contenteditable="true"][role="textbox"]',
    "textarea[aria-label], textarea[placeholder]",
    "input[aria-label], input[placeholder]",
  ],
  warning: '[role="alert"], [role="dialog"], [aria-live="assertive"]',
  captcha: [
    'iframe[src*="captcha" i]',
    '[aria-label*="captcha" i]',
    '[data-testid*="captcha" i]',
  ],
} as const;
