# TEST-PLAN — FREELANCE LEAD RADAR

v0.7 — 2026-07-20 — P6 candidate có 39 test file / 407 test; toàn repo 90,57% line coverage, rules-engine 97,83%; extension vượt gate 80%.

## 1. Hai quy tắc vàng

1. **Test tự động KHÔNG BAO GIỜ chạm facebook.com thật.** Mọi test chạy trên fixture HTML local và MockProvider. Tương tác với Facebook thật chỉ diễn ra trong smoke test THỦ CÔNG do người dùng thực hiện (§7).
2. **Không dữ liệu cá nhân thật trong repo.** Fixture phải qua quy trình làm sạch (§3).

## 2. Kim tự tháp test

| Tầng              | Công cụ                                                               | Phạm vi                                                                                                       | Khi chạy                                        |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Unit              | Vitest (+ happy-dom cho adapter)                                      | rules-engine (dày nhất), shared schemas, adapter parse, worker handlers với MockProvider, LeadStore, counters | Mỗi commit                                      |
| Contract          | Vitest                                                                | Request/response Workers API validate bằng đúng zod schema của `shared` cả 2 chiều                            | Mỗi commit                                      |
| Integration (e2e) | Playwright (Chromium + extension unpacked, `launchPersistentContext`) | Fixture page serve local + mock API server; toàn pipeline trong trình duyệt thật                              | Trước khi kết thúc phase; CI nightly (tùy chọn) |
| Manual smoke      | Con người (DUC)                                                       | Facebook thật, 1 nhóm test, checklist §7                                                                      | Cuối P9 và trước mỗi bản phát hành              |

Vitest setup toàn cục **chặn network** (fetch bị stub throw) — test nào cần HTTP phải mock rõ ràng. Đây vừa là vệ sinh test vừa là hàng rào an toàn.

## 3. Fixtures — quy trình tạo và làm sạch

- Nguồn: lưu DOM bài viết từ phiên đăng nhập của chính người dùng (Save As / copy outerHTML), thao tác tay.
- Bắt buộc làm sạch trước khi commit: thay toàn bộ tên thật → tên giả (`Nguyen V.`), avatar/ảnh → placeholder, SĐT/Zalo/email thật → số giả dạng `09xx xxx xxx`, ID nhóm/bài thật → ID giả tự đặt, xóa mọi token/tracking param trong URL.
- Mỗi fixture kèm file `.meta.json`: mô tả biến thể, ngày lấy, trường kỳ vọng (expected extraction) — test đọc meta để assert.
- Danh mục fixture tối thiểu (P3): bài text thuê freelancer chuẩn; bài truncated "Xem thêm"; poster ẩn danh; bài kèm ảnh; bài share lại; bài có liên hệ công khai; feed 10 bài trộn 4 loại; trang permalink + ô bình luận; trang checkpoint; hộp CAPTCHA; banner "tạm thời bị chặn".

## 4. Trọng tâm unit test theo package

### rules-engine (phủ dày nhất — bảng case tiếng Việt tiêu biểu)

| #   | Input tóm tắt                                                                         | Kỳ vọng                                      |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | "Cần 1 bạn edit video TikTok, budget 300k/video, cần gấp, ib mình"                    | gate=pass; không filter; field=video_editing |
| 2   | "Em nhận design poster giá sinh viên, ủng hộ em ạ"                                    | `poster_seeking_work`                        |
| 3   | "Công ty ABC tuyển 02 designer, làm tại Q1, lương 12-15tr, gửi CV"                    | `fulltime_recruitment`                       |
| 4   | "Việc nhẹ lương cao 300-500k/ngày, chỉ cần điện thoại, ib hướng dẫn"                  | `ad_or_spam` (gate chặn trước AI)            |
| 5   | "Cần bạn làm logo, yêu cầu làm thử 1 mẫu miễn phí trước"                              | `free_trial_required`                        |
| 6   | "Cần bạn viết content fanpage dài hạn, 30 bài/tháng" (team không nhận content — A-01) | `no_team_skill_match`                        |
| 7   | Bài có postKey đã tồn tại trong dedupe                                                | `already_processed`, 0 call AI               |
| 8   | Circuit breaker đang tripped                                                          | `facebook_warning_active`, pipeline đứng     |
| 9   | Đã chèn 10 bình luận hôm nay                                                          | `daily_limit_reached`                        |
| 10  | "Tuyển CTV viết bài SEO, làm online, 50k/bài 500 từ"                                  | hiring_freelancer (theo A-07)                |
| 11  | "Tuyển CTV trực page ca tối 18h-23h tại văn phòng"                                    | fulltime_recruitment                         |
| 12  | "Cần dev làm web, không nhận agency/team, chỉ tuyển vào công ty"                      | `no_outsourcing`                             |
| 13  | Điểm thành phần tổng 96 nhưng confidence 0.8                                          | score bị cap 94, autoEligible=false          |
| 14  | Điểm 96, confidence 0.9                                                               | autoEligible=true, vẫn needs_review (MVP)    |
| 15  | Bài tiếng Anh "Looking for a freelance video editor, $100/video"                      | gate=pass (hỗ trợ cơ bản EN)                 |

Cộng thêm: test bảng cho parser ngân sách VN ("500k"→500000; "2tr"→2000000; "1m2"→1200000; "2-3 triệu"→range; "$100"→USD giữ raw; "thỏa thuận"→null), parser deadline tương đối ("tối nay", "trước CN", "trong tuần"), counters reset đúng múi giờ Asia/Bangkok, máy trạng thái đủ cạnh.

### facebook-adapter

Extract đúng trên mọi fixture (assert theo `.meta.json`); không throw với HTML cắt xén; `parsePostKey` ≥ 6 dạng URL + URL rác; `detectWarningSignals` đúng trên 3 fixture cảnh báo và im lặng trên feed thường; **export surface không có hàm submit** (test tĩnh, bất biến SECURITY #15).

### workers/api

Auth 401 / rate limit 429 / payload 413 / batch >10 → 400; JSON AI hỏng → retry 1 → 502; MockProvider trả kịch bản cấu hình được theo test; không log body (spy logger).

### shared

Parse hợp lệ/không hợp lệ từng schema; default `autoReply.enabled=false`; hằng số ngưỡng 75/94/95 khớp tài liệu (test đọc hằng số so với giá trị văn bản — chống sửa nhầm).

## 5. Kịch bản e2e Playwright (fixture local + mock API)

| ID     | Kịch bản                     | Assert chính                                             |
| ------ | ---------------------------- | -------------------------------------------------------- |
| E2E-01 | Nhóm ngoài allowlist         | 0 POST_SEEN, 0 call API                                  |
| E2E-02 | Feed 10 bài trộn 4 loại      | 3 lead cần duyệt; bài loại có lý do trong tab Đã lọc     |
| E2E-03 | Chạy lại cùng feed           | 0 call API mới (dedupe)                                  |
| E2E-04 | P6: sửa nháp → duyệt local   | `editedText` persist + audit; không có nút Chèn/Đăng     |
| E2E-05 | Chèn 2 lead cách < 5 phút    | Lead 2 bị chặn + thông báo                               |
| E2E-06 | Emergency Stop giữa pipeline | Dừng cả 3 lớp; bật lại → tiếp tục được                   |
| E2E-07 | Fixture checkpoint xuất hiện | Circuit trip < 1s; nút Chèn vô hiệu; cần reset tay       |
| E2E-08 | Counters đạt 10 comment/ngày | Toàn bộ nút Chèn vô hiệu + tooltip                       |
| E2E-09 | API down                     | Lead trạng thái lỗi, retry tay được, không crash         |
| E2E-10 | Lead 96 điểm confidence cao  | Cờ autoEligible hiển thị, KHÔNG có hành động tự động nào |

## 6. Đo precision — giao thức chuẩn (điều kiện mở Auto Reply)

- **Đơn vị mẫu**: mọi lead hệ thống đưa vào hàng đợi duyệt (score ≥ 75).
- **Nhãn**: người dùng chọn `Đúng lead` (bài thật sự thuê freelancer, đúng chuyên môn team) hoặc `Sai lead`. Nhãn độc lập với việc có bình luận hay không (bận không comment vẫn phải nhãn được).
- **Precision** = Đúng / (Đúng + Sai). Bỏ qua lead chưa nhãn khi tính; dashboard hiển thị cả tỷ lệ đã nhãn.
- **Gate Auto Reply**: n ≥ 100 nhãn thu trong vận hành thật **và** precision ≥ 90%. Dashboard hiển thị tiến độ; không đạt → màn hình gate ghi rõ thiếu gì.
- **Recall proxy** (không chặn gate nhưng phải theo dõi): nút "Báo bài bị bỏ sót" khi người dùng tự thấy bài tốt mà hệ thống không bắt; đếm hàng tuần.
- **Theo dõi drift**: `extractionFailureRate > 20%/ngày` → banner "Facebook có thể đã đổi giao diện — dữ liệu có thể thiếu"; precision rolling 50 nhãn gần nhất tụt < 85% sau khi đã mở Auto Reply → tự tắt Auto Reply + yêu cầu rà soát.

## 7. Checklist smoke test thủ công trên Facebook thật (chỉ DUC thực hiện)

Điều kiện: allowlist đúng 1 nhóm test; giới hạn ngày để mặc định; làm tuần tự, dừng ngay nếu có bất kỳ cảnh báo nào từ Facebook.

1. Mở nhóm NGOÀI allowlist, lướt 2 phút → popup hiển thị 0 bài quét (kỳ vọng: extension ngủ).
2. Mở nhóm trong allowlist, lướt 20 bài → counters tăng; bài rõ ràng spam/tìm việc không xuất hiện trong hàng đợi.
3. Chọn 1 lead ≥ 75, đọc giải thích điểm, sửa nháp 1 câu, bấm Chèn trên bài đang mở → nội dung nằm trong ô bình luận, CHƯA đăng; tự bấm Đăng; xác nhận status `commented` + audit đủ chuỗi.
4. Mở lại đúng bài đó → không còn nút hành động (dedupe).
5. Bật Emergency Stop → lướt tiếp 1 phút → 0 hoạt động mới; tắt → hoạt động lại.
6. Kiểm tra audit log: mọi bước ở trên có mặt, timestamp hợp lý.
7. Xuất JSON → mở file kiểm tra không chứa trường lạ.
8. (Nếu Facebook hiện bất kỳ cảnh báo nào trong lúc test) → xác nhận banner đỏ + mọi nút vô hiệu → DỪNG toàn bộ phiên test, ghi nhận.

Kết quả checklist ghi vào báo cáo phase P9, có chữ ký xác nhận của DUC.

## 8. Quality gates trong CI

Thứ tự hiện tại: `install` → `check-secrets` → `check-api-safety` → `typecheck` → `lint` (kèm rule an toàn) → `unit + contract` → `test:coverage` → `build extension` → cài Chromium → 2 E2E (ngoài allowlist + pipeline P6). Bất kỳ bước nào đỏ → không merge. CI chặn rules-engine nếu line coverage < 90%; facebook-adapter, workers/api và extension nếu < 80%.
