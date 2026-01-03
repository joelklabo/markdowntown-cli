import { describe, it, expect } from "vitest";
import { cacheHeaders, hasSessionCookie } from "@/config/cache";

describe("cache headers", () => {
  it("marks responses cacheable for anonymous requests", () => {
    const headers = cacheHeaders("browse", null);
    expect(headers["Cache-Control"]).toContain("s-maxage=");
    expect(headers.Vary).toBe("Cookie");
  });

  it("marks responses private and no-store when session cookie present", () => {
    const headers = cacheHeaders("browse", "next-auth.session-token=abc");
    expect(headers["Cache-Control"]).toBe("private, no-store");
    expect(headers.Vary).toBe("Cookie");
  });
});

describe("hasSessionCookie", () => {
  it("detects next-auth tokens", () => {
    expect(hasSessionCookie("next-auth.session-token=abc")).toBe(true);
    expect(hasSessionCookie("__Secure-next-auth.session-token=abc")).toBe(true);
    expect(hasSessionCookie("sid=123; other=1")).toBe(false);
  });
});
