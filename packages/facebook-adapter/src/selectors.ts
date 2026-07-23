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
  // P6.12: hệ quả trực tiếp của P6.9 — bài viết kiểu mới (div thường, không
  // role="article") thì fallback dir=auto CŨ không tìm thấy gì vì nó đòi hỏi
  // tổ tiên role="article" (chỉ còn comment giữ role đó). Xác nhận qua file
  // Facebook thật DUC lưu lại 2026-07-22: 3/7 bài kiểu mới bị "missing_text"
  // dù đã có permalink đúng. Bỏ tiền tố '[role="article"] ' — an toàn cho bài
  // kiểu CŨ vì querySelectorAll từ chính article (đã có role="article") vốn
  // đã tự thoả compound selector đó cho MỌI dir=auto con cháu của nó, nên hành
  // vi bài kiểu cũ giữ nguyên y hệt (đã kiểm chứng bằng test dòng dưới và mô
  // phỏng lại toàn bộ extractPost() bằng Python trên dữ liệu Facebook thật).
  // ownedMatches() ở extract.ts vẫn lọc đúng phạm vi bài viết (không lấy nhầm
  // nội dung comment lồng bên trong) nên không cần đổi gì thêm ở extract.ts.
  message: [
    '[data-ad-preview="message"]',
    '[data-testid="post_message"]',
    '[dir="auto"]',
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
