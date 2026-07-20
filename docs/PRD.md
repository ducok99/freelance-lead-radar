# PRD — FREELANCE LEAD RADAR

|            |                                 |
| ---------- | ------------------------------- |
| Phiên bản  | v0.1 (đã được DUC duyệt)        |
| Ngày       | 2026-07-18                      |
| Trạng thái | Đang triển khai — hoàn thành P1 |

## 1. Bối cảnh và vấn đề

Đội trưởng một nhóm freelancer tại Việt Nam (DUC) hiện phải lướt thủ công nhiều nhóm Facebook để tìm bài đăng thuê freelancer. Vấn đề:

- Lead trôi rất nhanh: bài tốt thường chốt trong 30–60 phút đầu, ai bình luận sớm và đúng nhu cầu có lợi thế lớn.
- Nhiễu cao: phần lớn bài trong nhóm là người tìm việc, tuyển full-time, quảng cáo hoặc lừa đảo ("việc nhẹ lương cao").
- Bình luận thủ công tốn thời gian, dễ trùng lặp, dễ bỏ sót, không có nơi lưu và phân công lead cho thành viên.

FREELANCE LEAD RADAR là Chrome Extension chạy trong trình duyệt đã đăng nhập của chính người dùng, **chỉ đọc nội dung đang hiển thị** trong các nhóm thuộc allowlist, phát hiện bài thuê freelancer, chấm điểm, trích xuất thông tin, soạn sẵn bình luận cá nhân hóa để **con người duyệt trước khi đăng**, lưu lead và phân công cho thành viên.

## 2. Mục tiêu và không-phải-mục-tiêu

### Mục tiêu (MVP)

1. Theo dõi thụ động các nhóm Facebook trong allowlist do người dùng cấu hình.
2. Phát hiện bài mới đang tìm thuê freelancer, phân biệt chính xác 4 loại bài (mục 6).
3. Chấm điểm phù hợp 0–100 với ngưỡng hành động rõ ràng (mục 7).
4. Trích xuất: nội dung công việc, lĩnh vực, ngân sách, deadline, phần mềm yêu cầu, thông tin liên hệ công khai, URL và ID bài viết.
5. Soạn bình luận cá nhân hóa; người dùng sửa / duyệt / bỏ qua / đăng.
6. Không bao giờ bình luận trùng một bài (dedupe theo post ID).
7. Lưu lead, phân công cho thành viên phù hợp, có audit log và Emergency Stop.

### Không-phải-mục-tiêu (nêu rõ để tránh mở rộng ngoài ý muốn)

- KHÔNG phải công cụ spam hay tăng tương tác hàng loạt.
- KHÔNG crawl/bot phía server, không tự điều hướng trình duyệt, không tự refresh trang, không mở tab nền để quét.
- KHÔNG tự động gửi tin nhắn riêng (DM) trong mọi giai đoạn.
- KHÔNG tự đăng bình luận trong MVP, kể cả bài đạt 95+ điểm.
- KHÔNG thu thập dữ liệu Facebook ngoài mục đích xử lý lead hiện tại.
- KHÔNG quản lý dự án/hóa đơn sau khi chốt lead (ngoài phạm vi sản phẩm).

## 3. Người dùng và vai trò

| Vai trò          | Mô tả                                                                                          | Quyền trong MVP                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Đội trưởng (DUC) | Người duy nhất cài extension trong MVP, cấu hình allowlist, duyệt và đăng bình luận, phân công | Toàn quyền                                                                                             |
| Thành viên team  | Freelancer nhận việc được phân công                                                            | Chưa đăng nhập hệ thống; chỉ là bản ghi tên + kỹ năng để gán lead (giai đoạn 2 mới có tài khoản riêng) |

## 4. User stories chính

- **US-01** Là đội trưởng, tôi cấu hình danh sách nhóm allowlist (URL nhóm) và danh sách lĩnh vực chuyên môn của team.
- **US-02** Khi tôi lướt một nhóm trong allowlist, extension đọc các bài đang hiển thị, lọc và chấm điểm; bài đạt ngưỡng hiện badge điểm nhỏ trên bài + xuất hiện trong hàng đợi duyệt (side panel).
- **US-03** Với mỗi lead trong hàng đợi, tôi xem: điểm + giải thích điểm, phân loại, thông tin trích xuất, bình luận nháp. Tôi có thể sửa, duyệt, hoặc bỏ qua.
- **US-04** Khi tôi duyệt và bấm "Chèn bình luận" trên bài đang mở, extension điền sẵn nội dung vào ô bình luận; tôi tự bấm Đăng (mặc định MVP — xem Q-02).
- **US-05** Extension không bao giờ đề xuất lại bài tôi đã xử lý (đã bình luận / đã bỏ qua).
- **US-06** Tôi phân công lead cho thành viên; hệ thống gợi ý thành viên theo lĩnh vực.
- **US-07** Tôi dán nhãn "đúng lead / sai lead" cho từng lead để đo precision, phục vụ điều kiện mở Auto Reply.
- **US-08** Tôi bấm Emergency Stop ở popup: mọi hoạt động (đọc, gọi AI, chèn bình luận) dừng ngay.
- **US-09** Tôi xem audit log mọi hành động, đặc biệt là mọi lần đăng bình luận.
- **US-10** Nếu Facebook hiển thị CAPTCHA/checkpoint/cảnh báo, extension tự dừng và báo tôi biết.

## 5. Luồng hoạt động chính (MVP)

```
Người dùng lướt nhóm allowlist (thao tác tay, extension KHÔNG tự điều hướng)
        │
        ▼
Content script quan sát bài đang hiển thị (MutationObserver + IntersectionObserver)
        │
        ▼
Trích xuất DOM (facebook-adapter) → Post object
        │
        ▼
Lọc cứng giai đoạn 1 + gate từ khóa (rules-engine, chạy local, miễn phí)
        │  (rớt → ghi lý do, dừng)
        ▼
Gửi backend (Cloudflare Worker) → AI phân loại + chấm điểm thành phần + trích xuất + soạn nháp
        │
        ▼
Lọc cứng giai đoạn 2 + tổng hợp điểm deterministic (rules-engine)
        │
        ├── < 75  → lưu tối giản (dedupe + thống kê), không hiện hàng đợi
        ├── 75–94 → hàng đợi duyệt kèm bình luận nháp
        └── ≥ 95  → hàng đợi duyệt + cờ "đủ điều kiện Auto Reply" (MVP vẫn phải duyệt tay)
        │
        ▼
Người dùng sửa/duyệt/bỏ qua → Chèn bình luận vào bài đang mở → người dùng tự bấm Đăng
        │
        ▼
Ghi nhận đã bình luận (dedupe) + audit log + phân công thành viên
```

## 6. Bốn loại bài — định nghĩa vận hành và ví dụ thực tế

| Loại                   | Định nghĩa                                                                                  | Ví dụ điển hình (tiếng Việt)                                                                     | Hành động                    |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------- |
| `hiring_freelancer`    | Cá nhân/tổ chức cần THUÊ NGOÀI người làm một công việc cụ thể, trả phí theo việc/theo dự án | "Cần 1 bạn edit video TikTok 1–2p, có kịch bản sẵn, budget 300k/video, cần gấp tối nay, ib mình" | Chấm điểm, có thể thành lead |
| `seeking_work`         | Người ĐI TÌM VIỆC, chào dịch vụ của chính họ                                                | "Em nhận design poster, banner giá sinh viên, mọi người ủng hộ em ạ"                             | Loại (hard filter)           |
| `fulltime_recruitment` | Tuyển nhân viên chính thức: lương tháng, làm tại văn phòng, giờ hành chính, yêu cầu CV      | "Công ty TNHH ABC tuyển 02 designer làm việc tại Q1, lương 12–15tr, gửi CV về mail…"             | Loại (hard filter)           |
| `ad_or_spam`           | Quảng cáo, lừa đảo, đa cấp, không liên quan                                                 | "Việc nhẹ lương cao 300–500k/ngày, chỉ cần điện thoại, ib để được hướng dẫn"                     | Loại (hard filter)           |

Trường hợp nhập nhằng đã nhận diện (quy tắc chi tiết nằm trong rules-engine, có test riêng):

- **"Tuyển CTV" (cộng tác viên)**: nếu làm online, trả theo sản phẩm/bài → coi là `hiring_freelancer` (giả định A-07, chờ xác nhận). Nếu yêu cầu ca trực cố định, KPI như nhân viên → `fulltime_recruitment`.
- **"Làm thử miễn phí / test không lương"**: dù là bài thuê thật vẫn LOẠI theo hard filter `free_trial_required`.
- **Bài nói rõ "không nhận team/agency, chỉ tuyển inhouse"** → loại theo `no_outsourcing`.
- **Người đăng ẩn danh**: vẫn có thể là lead hợp lệ, đánh cờ `anonymousPoster`, điểm liên hệ thấp hơn.

## 7. Chấm điểm 0–100

AI chấm ĐIỂM THÀNH PHẦN + phân loại + trích xuất; **rules-engine tổng hợp điểm cuối một cách deterministic** để có thể test và giải thích được. Trọng số (hằng số cấu hình trong `packages/rules-engine`, có thể tinh chỉnh sau khi có dữ liệu nhãn):

| Thành phần           | Tối đa | Tiêu chí                                                                            |
| -------------------- | ------ | ----------------------------------------------------------------------------------- |
| Ý định thuê rõ ràng  | 40     | Mức chắc chắn bài đang cần thuê ngoài làm việc cụ thể                               |
| Ngân sách            | 15     | Nêu số tiền cụ thể: 15; nói "có budget/ib giá": 8; không nhắc: 0                    |
| Khớp chuyên môn team | 15     | Khớp mạnh lĩnh vực team: 15; khớp một phần: 8 (không khớp → đã bị hard filter loại) |
| Độ gấp / deadline    | 10     | Deadline cụ thể: 10; "cần gấp": 6; không rõ: 0                                      |
| Khả năng liên hệ     | 10     | SĐT/Zalo/email công khai: 10; "ib mình": 6; ẩn danh không kênh: 2                   |
| Chất lượng mô tả     | 10     | Phạm vi việc rõ, khối lượng rõ                                                      |

Điều chỉnh deterministic sau AI: nghi vấn spam mềm −20; nội dung đăng lặp lại −10; `confidence` của AI < 0.85 → điểm cuối bị chặn trần 94 (không bao giờ vào diện Auto Reply).

### Ngưỡng hành động (cố định theo spec)

| Điểm  | Hành động                                                             |
| ----- | --------------------------------------------------------------------- |
| 0–74  | Bỏ qua. Vẫn lưu bản ghi tối giản để dedupe và soát "lead bị bỏ sót"   |
| 75–94 | Soạn bình luận nháp, đưa vào hàng đợi chờ duyệt                       |
| ≥ 95  | Chỉ đánh dấu cờ `autoEligible`. **Trong MVP tuyệt đối không tự đăng** |

### Điều kiện mở tính năng Auto Reply (giai đoạn 2)

Auto Reply chỉ được phép triển khai khi **cả ba** điều kiện sau thỏa: (1) đã dán nhãn tối thiểu **100 bài** trong vận hành thật; (2) **precision ≥ 90%** trên tập nhãn đó; (3) DUC phê duyệt riêng bằng văn bản. Mặc định luôn OFF. Chi tiết trong IMPLEMENTATION-PLAN.md phase G2-2.

## 8. Trích xuất dữ liệu

| Trường                       | Bắt buộc | Ví dụ                                                                                    |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| Nội dung công việc (tóm tắt) | Có       | "Edit 10 video TikTok 1–2 phút từ footage có sẵn"                                        |
| Lĩnh vực                     | Có       | `video_editing`                                                                          |
| Ngân sách                    | Không    | raw: "300k/video" → min 300000, max 300000, đơn vị VND, theo video                       |
| Deadline                     | Không    | raw: "tối nay" → parsed ngày nếu suy ra được                                             |
| Phần mềm yêu cầu             | Không    | ["CapCut", "Premiere"]                                                                   |
| Liên hệ công khai            | Không    | [{kênh: "zalo", giá trị: "09xxx"}] — chỉ lấy thông tin người đăng tự công khai trong bài |
| URL + ID bài viết            | Có       | permalink chuẩn hóa + `postKey`                                                          |

Ngân sách kiểu Việt Nam phải parse được: "500k", "2tr", "2–3 triệu", "1m2", "$100", "thỏa thuận". Luôn giữ chuỗi gốc `raw` bên cạnh giá trị đã chuẩn hóa.

## 9. Bình luận cá nhân hóa

Nguyên tắc soạn nháp (AI ở backend, template + ngữ cảnh bài + hồ sơ năng lực team từ Settings):

1. Tiếng Việt tự nhiên, xưng hô trung tính "mình – bạn"; 2–4 câu, không kể lể.
2. Câu đầu bám đúng nhu cầu trong bài (chứng minh đã đọc bài).
3. Một câu năng lực liên quan trực tiếp (lấy từ hồ sơ team, không bịa số liệu, không hứa hẹn sai).
4. CTA nhẹ ("ib mình xem portfolio nhé"), không chèn link rút gọn, không emoji dày đặc, không báo giá trừ khi bài hỏi giá.
5. Mỗi nháp kèm phần "giải thích điểm" để người duyệt quyết định nhanh.
6. **Mọi nháp đều phải qua người duyệt trong MVP.** Không có ngoại lệ.

## 10. Chống trùng và giới hạn hoạt động

- Dedupe theo `postKey` (chuẩn hóa từ group ID + post ID). Bài đã bình luận / đã bỏ qua / đang trong hàng đợi → không xử lý lại, không gọi AI lại.
- Giới hạn ngày (mặc định, cấu hình được — giả định A-08): tối đa **10 bình luận/ngày**, khoảng cách tối thiểu **5 phút** giữa 2 lần chèn bình luận, tối đa **200 lần gọi AI phân loại/ngày**. Chạm giới hạn → hard filter `daily_limit_reached`, hiện thông báo rõ.

## 11. Metrics thành công (MVP)

| Metric                                        | Mục tiêu                                         | Cách đo                                 |
| --------------------------------------------- | ------------------------------------------------ | --------------------------------------- |
| Precision phân loại lead (≥75 điểm)           | ≥ 90% sau giai đoạn tinh chỉnh                   | Nhãn đúng/sai của người dùng, ≥ 100 mẫu |
| Thời gian bài xuất hiện → bình luận được đăng | < 10 phút trong giờ làm việc                     | timestamp seenAt → commentedAt          |
| Lead hợp lệ/tuần                              | Theo dõi xu hướng (chưa đặt mục tiêu cứng)       | Đếm lead label=đúng                     |
| Tỷ lệ trích xuất lỗi (adapter)                | < 20%/ngày; vượt → banner cảnh báo đổi giao diện | extractionFailureRate                   |
| Tỷ lệ chốt việc từ lead                       | Ghi tay trạng thái won/lost                      | Pipeline dashboard                      |

## 12. Giả định (A) và câu hỏi mở (Q)

> Đây là danh sách đầy đủ theo yêu cầu "liệt kê toàn bộ giả định và câu hỏi còn thiếu". Mỗi giả định có ghi ảnh hưởng nếu sai. Làm việc tiếp được ngay cả khi chưa trả lời hết — nhưng các mục đánh dấu ⚑ nên chốt trước phase liên quan.

| ID      | Giả định hiện tại / Câu hỏi                                                                                                                                                                                                            | Ảnh hưởng nếu khác                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A-01 ✅ | **ĐÃ CHỐT 2026-07-18**: team nhận thiết kế đồ họa (gồm banner, poster, ấn phẩm, thư mời…), video/dựng phim, web/lập trình, và kiến trúc. Team KHÔNG nhận content/marketing thuần → bài thuê viết content bị loại `no_team_skill_match` | —                                                                            |
| A-02 ✅ | **ĐÃ CHỐT 2026-07-18**: sau khi duyệt, extension CHỈ điền sẵn ô bình luận, người dùng tự bấm Đăng                                                                                                                                      | —                                                                            |
| A-03    | AI provider: Anthropic Claude qua Cloudflare Workers (model nhỏ để phân loại, model lớn hơn để soạn nháp), giấu key bằng Workers secret. Interface `AIProvider` cho phép đổi provider                                                  | Đổi provider chỉ chạm workers/api                                            |
| A-04    | MVP chỉ một người dùng (đội trưởng) chạy extension; dữ liệu nằm local (chrome.storage.local). Đồng bộ team qua D1 là giai đoạn 2                                                                                                       | Nếu cần nhiều người dùng ngay → phải kéo D1 + auth lên sớm, kế hoạch dài hơn |
| A-05    | Chỉ hỗ trợ Facebook bản desktop `www.facebook.com` giao diện hiện hành; không hỗ trợ m.facebook/mbasic                                                                                                                                 | Thêm biến thể → thêm fixture + adapter                                       |
| A-06    | Bài viết chủ yếu tiếng Việt, hỗ trợ cơ bản tiếng Anh                                                                                                                                                                                   | Lexicon và prompt tối ưu cho tiếng Việt                                      |
| A-07    | Bài "tuyển CTV" online trả theo sản phẩm được tính là lead freelance                                                                                                                                                                   | Nếu không, thêm rule loại CTV                                                |
| A-08    | Giới hạn mặc định: 10 bình luận/ngày, cách nhau ≥ 5 phút, 200 lần gọi AI/ngày. **Q: con số mong muốn?**                                                                                                                                | Chỉ đổi hằng số cấu hình                                                     |
| A-09    | Lưu lead tối đa 90 ngày (mặc định, cấu hình được), hết hạn tự xóa                                                                                                                                                                      | Chính sách dữ liệu cá nhân (SECURITY.md)                                     |
| A-10    | Extension phân phối nội bộ (load unpacked / file zip), KHÔNG đưa lên Chrome Web Store trong MVP vì rủi ro chính sách CWS với công cụ tương tác Facebook                                                                                | Nếu muốn lên CWS phải rà soát chính sách riêng                               |
| A-11    | "Xem thêm" KHÔNG tự bấm (nguyên tắc đọc thụ động). Bài bị cắt ngắn được đánh dấu `truncated`, phân tích đầy đủ khi người dùng mở bài. **Q: có muốn tùy chọn tự mở rộng?**                                                              | Tự bấm = tăng độ chính xác nhưng thêm một hành vi tự động                    |
| A-12    | Số nhóm allowlist dự kiến ≤ 20, tổng bài lướt qua ≤ 200/ngày. **Q: quy mô thật?**                                                                                                                                                      | Ảnh hưởng chi phí AI và giới hạn ngày                                        |
| A-13    | Repo đặt trên GitHub, CI bằng GitHub Actions                                                                                                                                                                                           | Chỉ ảnh hưởng cấu hình CI                                                    |
| A-14    | Người đăng ẩn danh vẫn tính là lead (cờ riêng, điểm liên hệ thấp)                                                                                                                                                                      | Nếu không → thêm hard filter                                                 |
| A-15    | Ngân sách vận hành AI chấp nhận ~1–2 USD/ngày ở quy mô A-12 (ước tính thô, cần đối chiếu bảng giá hiện hành). **Q: trần chi phí/tháng?**                                                                                               | Ảnh hưởng chọn model và giới hạn gọi AI                                      |

## 13. Rủi ro sản phẩm và giảm thiểu

| Rủi ro                                                                            | Mức                                   | Giảm thiểu                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vi phạm điều khoản Facebook về tự động hóa → hạn chế/khóa tài khoản người dùng    | Cao                                   | Thiết kế thụ động (không tự điều hướng), human-in-the-loop, giới hạn ngày, tự dừng khi có cảnh báo, Emergency Stop. **Rủi ro tồn dư vẫn còn và người dùng cần chấp nhận trước khi bật bất kỳ chế độ nào** — nêu thẳng trong SECURITY.md §8 |
| Facebook đổi cấu trúc DOM → trích xuất hỏng                                       | Cao (chắc chắn xảy ra theo thời gian) | Toàn bộ va chạm DOM cô lập trong `facebook-adapter`, selector theo role/heuristic, fixture regression test, metric extractionFailureRate + banner cảnh báo                                                                                 |
| AI phân loại sai (đặc biệt bài tiếng Việt nhập nhằng)                             | Trung bình                            | Hard filter chạy trước và sau AI, tổng hợp điểm deterministic, quy trình dán nhãn đo precision, gate 100 bài/90% trước Auto Reply                                                                                                          |
| Chi phí AI vượt dự kiến                                                           | Thấp                                  | Gate từ khóa local trước khi gọi AI, giới hạn 200 call/ngày, batch request                                                                                                                                                                 |
| Dữ liệu cá nhân trong bài viết (SĐT, tên) — nghĩa vụ theo Nghị định 13/2023/NĐ-CP | Trung bình                            | Thu thập tối thiểu, chỉ dữ liệu công khai trong bài, retention 90 ngày, chức năng xóa, không chia sẻ ngoài mục đích xử lý lead                                                                                                             |
| Chính sách Chrome Web Store nếu publish                                           | Trung bình                            | MVP phân phối nội bộ (A-10)                                                                                                                                                                                                                |

## 14. Phạm vi MVP vs Giai đoạn 2

| MVP (P0–P9)                                              | Giai đoạn 2 (cần duyệt riêng)                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Extension + side panel + trang dashboard trong extension | Web dashboard riêng (apps/dashboard) cho cả team                              |
| chrome.storage.local                                     | Cloudflare D1 + đồng bộ + tài khoản thành viên                                |
| Duyệt tay 100% bình luận                                 | Auto Reply có kiểm soát (gate 100 nhãn / precision ≥ 90% / phê duyệt văn bản) |
| Một người dùng                                           | Nhiều người dùng, phân quyền                                                  |

## 15. Thuật ngữ (cho thành viên không chuyên kỹ thuật)

- **Lead**: bài viết có người thật đang cần thuê freelancer — cơ hội việc làm cho team.
- **Allowlist**: danh sách nhóm Facebook được PHÉP theo dõi; ngoài danh sách này extension không đọc gì.
- **Precision**: trong số bài hệ thống báo là lead, bao nhiêu % đúng thật. 90% = cứ 10 bài báo thì ≤ 1 bài sai.
- **Hard filter**: luật loại bỏ tuyệt đối, không cần AI, không có ngoại lệ.
- **Audit log**: nhật ký không sửa được, ghi lại mọi hành động của hệ thống và người dùng.
- **Emergency Stop**: nút dừng khẩn cấp toàn bộ hoạt động ngay lập tức.
