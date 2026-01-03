import { describe, it, expect } from "vitest";
import { validateSectionPayload } from "@/lib/validation";

describe("validatePayload", () => {
  it("rejects missing title", () => {
    expect(validateSectionPayload(null, "content")).toMatch(/Title is required/);
  });

  it("rejects long title", () => {
    const title = "x".repeat(141);
    expect(validateSectionPayload(title, "ok")).toMatch(/too long/);
  });

  it("rejects long content", () => {
    const content = "x".repeat(10_001);
    expect(validateSectionPayload("ok", content)).toMatch(/too long/);
  });

  it("rejects script tags", () => {
    expect(validateSectionPayload("ok", "<script>alert(1)</script>")).toMatch(/disallowed/);
  });

  it("allows valid payload", () => {
    expect(validateSectionPayload("ok", "safe" )).toBeNull();
  });
});
