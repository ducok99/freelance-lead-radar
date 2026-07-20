import { describe, expect, it } from "vitest";
import * as shared from "./index";

describe("public export surface @flr/shared", () => {
  it("export schemas và constants chính", () => {
    expect(shared.SettingsSchema).toBeDefined();
    expect(shared.LeadSchema).toBeDefined();
    expect(shared.ExtensionMessageSchema).toBeDefined();
    expect(shared.SCHEMA_VERSION).toBe(1);
  });

  it("không export API tự động đăng bình luận", () => {
    const exportNames = Object.keys(shared).map((name) => name.toLowerCase());
    expect(exportNames.some((name) => name.includes("submitcomment"))).toBe(
      false,
    );
    expect(exportNames.some((name) => name.includes("autoreplyposted"))).toBe(
      false,
    );
  });
});
