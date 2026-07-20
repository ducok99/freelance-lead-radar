# Chrome Extension P5.1 — hướng dẫn kiểm tra trên Windows

P5 là khung Chrome Extension Manifest V3 an toàn. Bản này có popup, side panel,
trang cài đặt, allowlist và Emergency Stop. **P5 chưa đọc bài, chưa gọi AI, chưa
gửi `POST_SEEN`, chưa chèn hoặc đăng bình luận.** Các chức năng pipeline thuộc
P6–P7 và chỉ được làm sau khi DUC duyệt từng phase.

P5.1 sửa lỗi build có thể hoán đổi entry giữa background service worker và
content script. Lệnh build giờ tự kiểm tra đúng background chunk trước khi tạo
bản `dist` để nạp vào Chrome.

## 1. Build

Mở Command Prompt tại `C:\Project\freelance-lead-radar` rồi chạy lần lượt:

```bat
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm --filter @flr/extension build
```

Khi thành công, thư mục cần nạp vào Chrome là:

```text
C:\Project\freelance-lead-radar\apps\extension\dist
```

Không chọn thư mục `apps\extension`; phải chọn đúng thư mục `dist` có file
`manifest.json`.

## 2. Load unpacked

1. Mở Chrome và nhập `chrome://extensions` vào thanh địa chỉ.
2. Bật **Developer mode / Chế độ dành cho nhà phát triển** ở góc trên bên phải.
3. Bấm **Load unpacked / Tải tiện ích đã giải nén**.
4. Chọn `C:\Project\freelance-lead-radar\apps\extension\dist`.
5. Xác nhận thẻ **Freelance Lead Radar** xuất hiện và không có nút **Errors**.
6. Ghim tiện ích bằng biểu tượng mảnh ghép trên thanh công cụ Chrome.

## 3. Cấu hình allowlist

1. Bấm biểu tượng **Freelance Lead Radar** rồi bấm **Cài đặt**.
2. Nhập tên gợi nhớ và URL dạng
   `https://www.facebook.com/groups/ten-hoac-id-nhom`.
3. Bấm **Thêm nhóm**.
4. Chọn kỹ năng team, nhập hồ sơ năng lực ngắn và thành viên nếu cần.
5. Để trống `TEAM_TOKEN` trong P5.
6. Bấm **Lưu toàn bộ cài đặt** và chờ thông báo “Đã lưu cài đặt trên máy này”.

Mỗi nhóm có nút **Tắt/Bật** và **Xóa**. Extension chỉ cho phép gate hoạt động khi
URL nhóm khớp chính xác một mục đang bật.

## 4. Smoke test P5

1. Mở một nhóm Facebook **không** có trong allowlist, mở popup và xác nhận dòng
   “Nhóm hiện tại: Không được theo dõi”.
2. Mở nhóm đã thêm, mở popup và xác nhận “Trong allowlist”.
3. Bấm **Mở hàng đợi**; side panel phải mở và hiển thị “Chưa có lead”. Đây là
   kết quả đúng vì P6 chưa được bật.
4. Bấm **Emergency Stop**; nút phải hiện “Đang cập nhật...”, sau đó popup hiện
   “ĐÃ DỪNG” và side panel hiện banner đỏ.
5. Đóng rồi mở lại Chrome, mở popup và xác nhận trạng thái dừng vẫn còn.
6. Bấm **Bật lại hệ thống**. Nếu trang Facebook đã mở khi hệ thống đang dừng,
   tải lại trang một lần sau khi bật lại.

## 5. Ảnh xác nhận cần gửi để đóng P5

Sau khi smoke test, chụp và gửi lại bốn ảnh sau trong cuộc trò chuyện:

1. `01-extension-loaded.png`: trang `chrome://extensions` có thẻ extension và
   không có lỗi.
2. `02-popup-allowlisted.png`: popup trên nhóm đã nằm trong allowlist.
3. `03-options-saved.png`: trang cài đặt có thông báo đã lưu (che token nếu có).
4. `04-emergency-stop.png`: popup hoặc side panel đang hiển thị Emergency Stop.

Ảnh gửi để đối chiếu thủ công phải che tên tài khoản, avatar, nội dung bài và
thông tin nhóm nếu có dữ liệu thật. Không commit ảnh Facebook thật hoặc dữ liệu
PII vào repo; báo cáo chỉ ghi kết quả kiểm tra.

## 6. Gỡ lỗi nhanh

- Không thấy `manifest.json`: đã chọn sai thư mục; chọn lại `apps\extension\dist`.
- Chrome báo version quá thấp: cập nhật Chrome lên bản 116 trở lên.
- Sửa code nhưng giao diện chưa đổi: build lại, vào `chrome://extensions` rồi bấm
  nút **Reload** trên thẻ extension.
- Popup không nhận nhóm: dùng URL chính của nhóm dưới `www.facebook.com/groups/`
  và kiểm tra mục đó đang ở trạng thái **Đang bật**.
- Không được commit `.dev.vars`, token, thư mục `.wrangler`, `dist` hoặc ảnh có
  dữ liệu Facebook/PII chưa che.

## 7. Quyền được khai báo

- `storage`: lưu settings, counters và Emergency Stop trên máy.
- `sidePanel`: mở hàng đợi lead ở cạnh trình duyệt.
- Host duy nhất: `https://www.facebook.com/*`.

Snapshot test sẽ fail nếu thêm `cookies`, `tabs`, `webRequest`, `scripting`,
`history` hoặc `<all_urls>`.
