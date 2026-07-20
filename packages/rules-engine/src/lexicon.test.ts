import { describe, expect, it } from "vitest";
import {
  classifyTextHeuristic,
  detectSkillFields,
  hasFreeTrialRequirement,
  hasNoOutsourcingRequirement,
  normalizeVietnameseText,
} from "./lexicon";

describe("Vietnamese lexicon", () => {
  it("chuẩn hóa dấu tiếng Việt và chữ Đ", () => {
    expect(normalizeVietnameseText("Đội ngũ THIẾT KẾ!")).toBe(
      "doi ngu thiet ke",
    );
  });

  it.each([
    ["Cần thiết kế logo và banner", "graphic_design"],
    ["Cần editor dựng video TikTok", "video_editing"],
    ["Tìm dev React làm landing page", "web_dev"],
    ["Cần dựng phối cảnh nội thất bằng 3ds Max", "architecture"],
    ["Cần người viết content và SEO", "other"],
  ] as const)("nhận diện lĩnh vực: %s", (text, expected) => {
    expect(detectSkillFields(text)).toContain(expected);
  });

  it("nhận diện được nhiều lĩnh vực trong cùng bài", () => {
    expect(detectSkillFields("Cần thiết kế logo và dựng video TikTok")).toEqual(
      ["graphic_design", "video_editing"],
    );
  });

  it("một tín hiệu spam yếu không đủ kết luận spam", () => {
    expect(
      classifyTextHeuristic(
        "Tuyển nhân viên junior không cần kinh nghiệm, vui lòng gửi CV.",
      ),
    ).toBe("fulltime_recruitment");
  });

  it("hai tín hiệu spam yếu được phân loại spam", () => {
    expect(
      classifyTextHeuristic(
        "Không cần kinh nghiệm, chỉ cần điện thoại, inbox để nhận việc.",
      ),
    ).toBe("ad_or_spam");
  });

  it("không tuyển nhân viên nhưng thuê freelancer vẫn là lead", () => {
    expect(
      classifyTextHeuristic(
        "Không tuyển nhân viên full-time, cần thuê freelancer thiết kế logo.",
      ),
    ).toBe("hiring_freelancer");
  });

  it("CTV mơ hồ được để lại cho bước AI", () => {
    expect(classifyTextHeuristic("Tuyển CTV thiết kế cho dự án mới.")).toBe(
      "unknown",
    );
  });

  it("phân biệt yêu cầu làm thử miễn phí với test có trả phí", () => {
    expect(
      hasFreeTrialRequirement("Cần làm demo miễn phí trước khi nhận job"),
    ).toBe(true);
    expect(hasFreeTrialRequirement("Bài test có trả phí 500k")).toBe(false);
  });

  it("nhận diện điều kiện không nhận outsourcing", () => {
    expect(
      hasNoOutsourcingRequirement("Chỉ tuyển inhouse, không thuê agency"),
    ).toBe(true);
  });
});
