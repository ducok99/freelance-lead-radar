import { describe, expect, it } from "vitest";
import { AuditDetailSchema, AuditEventSchema } from "./index";
import { validAuditEvent } from "./test-fixtures";

describe("AuditEventSchema", () => {
  it("chấp nhận metadata tối giản", () => {
    expect(AuditEventSchema.safeParse(validAuditEvent).success).toBe(true);
  });

  it.each([
    ["password", { password: "secret" }],
    ["cookie", { nested: { cookie: "c_user=1" } }],
    ["session", { sessionToken: "abc" }],
    ["TEAM_TOKEN", { team_token: "abc" }],
    ["API key", { note: ["sk", "ant", "TESTONLY12345678"].join("-") }],
    ["Bearer token", { note: "Bearer secret-value" }],
    ["Facebook cookie value", { note: "c_user=1; xs=secret" }],
    ["PII contact", { contact: "09xx xxx xxx" }],
    ["PII email", { nested: { email: "a@example.com" } }],
  ])("từ chối audit detail chứa %s", (_label, detail) => {
    expect(AuditDetailSchema.safeParse(detail).success).toBe(false);
  });

  it("từ chối dữ liệu không phải JSON", () => {
    expect(AuditDetailSchema.safeParse({ callback: () => true }).success).toBe(
      false,
    );
    expect(AuditDetailSchema.safeParse({ missing: undefined }).success).toBe(
      false,
    );
    expect(AuditDetailSchema.safeParse({ createdAt: new Date() }).success).toBe(
      false,
    );
    expect(AuditDetailSchema.safeParse({ values: new Map() }).success).toBe(
      false,
    );
  });

  it("từ chối PII dù nằm trong trường tên chung", () => {
    expect(
      AuditDetailSchema.safeParse({ note: "gửi mail lead@example.com" })
        .success,
    ).toBe(false);
    expect(
      AuditDetailSchema.safeParse({ note: "gọi 0912345678" }).success,
    ).toBe(false);
  });

  it("không nhầm groupId thông thường thành số điện thoại", () => {
    expect(AuditDetailSchema.safeParse({ groupId: "1234567890" }).success).toBe(
      true,
    );
  });

  it("từ chối tham chiếu vòng thay vì đệ quy vô hạn", () => {
    const detail: Record<string, unknown> = {};
    detail.self = detail;
    expect(AuditDetailSchema.safeParse(detail).success).toBe(false);
  });

  it("từ chối khóa có thể gây prototype pollution", () => {
    const detail = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(detail, "constructor", {
      enumerable: true,
      value: "blocked",
    });
    expect(AuditDetailSchema.safeParse(detail).success).toBe(false);
  });

  it("từ chối accessor mà không thực thi getter", () => {
    let accessed = false;
    const detail = {} as Record<string, unknown>;
    Object.defineProperty(detail, "computed", {
      enumerable: true,
      get: () => {
        accessed = true;
        return "value";
      },
    });
    expect(AuditDetailSchema.safeParse(detail).success).toBe(false);
    expect(accessed).toBe(false);
  });

  it("từ chối trường dư ở AuditEvent", () => {
    expect(
      AuditEventSchema.safeParse({ ...validAuditEvent, accessToken: "abc" })
        .success,
    ).toBe(false);
  });
});
