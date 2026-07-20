# Chrome Extension P6 v0.6.0 — hướng dẫn kiểm tra trên Windows

P6 là Chrome Extension Manifest V3 chỉ-đọc: đọc bài đang hiển thị trong nhóm
allowlist, lọc, gọi Workers API để chấm điểm/tạo nháp, lưu lead local và cho
người dùng sửa nháp, duyệt hoặc bỏ qua. **P6 không chèn, click hoặc đăng bình
luận lên Facebook.** Comment assist chỉ thuộc P7 sau khi DUC duyệt P6.

Build vẫn tự xác minh background service worker và content script dùng đúng
entry trước khi tạo `dist`.

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
5. Nhập `API Base URL` dạng `https://ten-worker.workers.dev` và `TEAM_TOKEN`
   khớp secret đã deploy. Không chụp hoặc gửi token trong ảnh.
6. Bấm **Lưu toàn bộ cài đặt** và chờ thông báo “Đã lưu cài đặt trên máy này”.

Mỗi nhóm có nút **Tắt/Bật** và **Xóa**. Extension chỉ cho phép gate hoạt động khi
URL nhóm khớp chính xác một mục đang bật.

## 4. Smoke test P6 chỉ đọc

1. Mở một nhóm Facebook **không** có trong allowlist, mở popup và xác nhận dòng
   “Nhóm hiện tại: Không được theo dõi”.
2. Mở nhóm đã thêm, mở popup và xác nhận “Trong allowlist”.
3. Mở bằng tay một nhóm trong allowlist và lướt chậm các bài đang hiển thị.
   Extension không tự cuộn, refresh, mở tab hoặc bấm “Xem thêm”.
4. Bấm **Mở hàng đợi**; lead đạt 75 điểm trở lên xuất hiện ở **Hàng đợi**, bài
   bị loại hoặc dưới ngưỡng xuất hiện ở **Đã lọc** kèm lý do.
5. Mở một lead, kiểm tra breakdown/extraction/nháp; sửa nháp, bấm **Lưu nháp**
   rồi **Duyệt lead**. Việc này chỉ đổi dữ liệu local.
6. Xác nhận side panel không có nút **Chèn**, **Đăng** hoặc Auto Reply; ô bình
   luận Facebook không bị sửa.
7. Bấm **Emergency Stop**; nút phải hiện “Đang cập nhật...”, sau đó popup hiện
   “ĐÃ DỪNG” và side panel hiện banner đỏ.
8. Đóng rồi mở lại Chrome, mở popup và xác nhận trạng thái dừng vẫn còn.
9. Bấm **Bật lại hệ thống**. Nếu trang Facebook đã mở khi hệ thống đang dừng,
   tải lại trang một lần sau khi bật lại.

## 5. Ảnh xác nhận cần gửi để đóng P6

Sau khi smoke test, chụp và gửi lại bốn ảnh sau trong cuộc trò chuyện:

1. `01-ci-p6-green.png`: workflow GitHub Actions P6 xanh.
2. `02-extension-v0.6.0.png`: trang `chrome://extensions` không có lỗi.
3. `03-p6-queue.png`: side panel có lead và điểm (che toàn bộ PII/nội dung thật).
4. `04-p6-filtered.png`: tab Đã lọc có lý do.
5. `05-p6-approved.png`: lead sau khi lưu nháp và Duyệt lead; không có nút
   Chèn/Đăng.

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
- Không có lead: kiểm tra Worker đang chạy, URL kết thúc bằng `.workers.dev`,
  token khớp, hồ sơ năng lực team không trống và Emergency Stop đang tắt.
- Lead báo lỗi: bấm **Thử lại** sau khi sửa API/token; không cần xóa lead.
- Không được commit `.dev.vars`, token, thư mục `.wrangler`, `dist` hoặc ảnh có
  dữ liệu Facebook/PII chưa che.

## 7. Quyền được khai báo

- `storage`: lưu settings, counters và Emergency Stop trên máy.
- `sidePanel`: mở hàng đợi lead ở cạnh trình duyệt.
- `https://www.facebook.com/*`: đọc DOM bài đang hiển thị sau allowlist gate.
- `https://*.workers.dev/*`: gọi Workers API đã cấu hình.
- `http://localhost/*`, `http://127.0.0.1/*`: chỉ phục vụ dev/E2E local.

Snapshot test sẽ fail nếu thêm `cookies`, `tabs`, `webRequest`, `scripting`,
`history` hoặc `<all_urls>`.
