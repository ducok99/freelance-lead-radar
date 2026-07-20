# fixtures/facebook

HTML giả lập các biến thể trang Facebook, dùng cho unit test `facebook-adapter` và integration test sau này. Fixture P3 là dữ liệu tổng hợp tối thiểu, không phải bản sao nguyên trạng của tài khoản hoặc nhóm thật.

## Quy tắc bắt buộc khi thêm fixture (TEST-PLAN.md §3)

1. Nguồn: lưu DOM từ phiên đăng nhập của chính người dùng, thao tác tay. Test tự động KHÔNG BAO GIỜ chạm facebook.com thật.
2. Làm sạch dữ liệu cá nhân TRƯỚC khi commit: tên thật → tên giả; avatar/ảnh → placeholder; SĐT/Zalo/email → dạng giả `09xx xxx xxx`; ID nhóm/bài thật → ID giả; xóa token/tracking param trong URL.
3. Mỗi fixture kèm file `.meta.json`: mô tả biến thể, ngày lấy, và kết quả trích xuất kỳ vọng để test assert.

## Checklist làm sạch trước khi commit

- Không có tên, ID, URL profile, avatar, nội dung hoặc thông tin liên hệ của người thật.
- ID nhóm/bài dùng dải giả `100...` / `200...`; tên dùng dạng `Nguyen V.` hoặc profile có hậu tố `-fake`.
- Điện thoại được che `09xx xxx xxx`; email dùng miền dành cho test `.test`.
- Không có cookie, session, access token, query tracking (`__cft__`, `fbclid`, token) hoặc HTML nền không cần thiết.
- Ảnh chỉ dùng placeholder data URI 1×1 hoặc mô tả text; không commit ảnh lấy từ Facebook.
- Chạy `pnpm check-secrets`, `pnpm lint` và toàn bộ test adapter sau khi thêm fixture.

## Danh mục P3

- 8 biến thể extract chính: text, truncated, anonymous, image, shared, contact, mixed feed và permalink có ô bình luận.
- 1 fixture layout bị cắt để xác nhận adapter trả `ExtractionFailure`, không throw.
- 3 fixture cảnh báo: checkpoint, CAPTCHA và banner tạm thời bị chặn.

Selector fixture chỉ mô phỏng `role`, `aria-*`, cấu trúc ngữ nghĩa và thuộc tính message ổn định. Không ghi class name obfuscated của Facebook.
