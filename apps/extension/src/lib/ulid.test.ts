import { UlidSchema } from "@flr/shared";
import { describe, expect, it } from "vitest";
import { createUlid } from "./ulid";

describe("createUlid", () => {
  it("tạo ID hợp schema, deterministic khi inject thời gian/random", () => {
    const id = createUlid(1_721_465_600_000, new Uint8Array(16).fill(7));
    expect(UlidSchema.parse(id)).toBe(id);
    expect(id).toHaveLength(26);
  });
});
