/**
 * Selector chỉ dựa trên role, aria và thuộc tính ngữ nghĩa. Không thêm class
 * Facebook đã obfuscate vào đây vì chúng thay đổi liên tục.
 */
export const SELECTORS = {
  post: '[role="article"]',
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
