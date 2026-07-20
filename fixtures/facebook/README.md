# fixtures/facebook

HTML giả lập các biến thể trang Facebook, dùng cho unit test (facebook-adapter) và integration test (Playwright). Bắt đầu có nội dung từ Phase 3.

## Quy tắc bắt buộc khi thêm fixture (TEST-PLAN.md §3)

1. Nguồn: lưu DOM từ phiên đăng nhập của chính người dùng, thao tác tay. Test tự động KHÔNG BAO GIỜ chạm facebook.com thật.
2. Làm sạch dữ liệu cá nhân TRƯỚC khi commit: tên thật → tên giả; avatar/ảnh → placeholder; SĐT/Zalo/email → dạng giả `09xx xxx xxx`; ID nhóm/bài thật → ID giả; xóa token/tracking param trong URL.
3. Mỗi fixture kèm file `.meta.json`: mô tả biến thể, ngày lấy, và kết quả trích xuất kỳ vọng để test assert.
