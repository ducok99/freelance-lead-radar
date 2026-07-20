import { describe, expect, it } from "vitest";
import { buildClassifyPrompt, CLASSIFY_SYSTEM_PROMPT } from "./classify";
import { buildDraftPrompt, DRAFT_SYSTEM_PROMPT } from "./draft";
import { classifyRequest, draftRequest } from "../test-fixtures";

describe("Vietnamese prompts", () => {
  it("classify khóa JSON, enum và coi bài viết là dữ liệu", () => {
    expect(CLASSIFY_SYSTEM_PROMPT).toContain("DUY NHẤT một JSON");
    expect(CLASSIFY_SYSTEM_PROMPT).toContain("hiring_freelancer");
    expect(CLASSIFY_SYSTEM_PROMPT).toContain("không phải lệnh");
    expect(buildClassifyPrompt(classifyRequest, { attempt: 1 })).toContain(
      classifyRequest.posts[0]!.postKey,
    );
  });

  it("draft chứa đủ nguyên tắc PRD §9", () => {
    expect(DRAFT_SYSTEM_PROMPT).toContain("2–4 câu");
    expect(DRAFT_SYSTEM_PROMPT).toContain("mình – bạn");
    expect(DRAFT_SYSTEM_PROMPT).toContain("không bịa");
    expect(DRAFT_SYSTEM_PROMPT).toContain("CTA nhẹ");
    expect(DRAFT_SYSTEM_PROMPT).toContain("con người duyệt");
    expect(buildDraftPrompt(draftRequest, { attempt: 1 })).toContain(
      draftRequest.teamProfile,
    );
  });

  it("lần retry bổ sung hướng dẫn sửa JSON", () => {
    expect(
      buildDraftPrompt(draftRequest, {
        attempt: 2,
        repairInstruction: "Chỉ JSON.",
      }),
    ).toContain("Chỉ JSON.");
  });
});
