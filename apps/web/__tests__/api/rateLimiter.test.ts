import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimitStore } from "@/lib/rateLimiter";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimitStore());

  it("allows up to the limit", () => {
    let allowed = 0;
    for (let i = 0; i < 30; i++) {
      if (rateLimit("ip1")) allowed++;
    }
    expect(allowed).toBe(30);
  });

  it("blocks after the limit", () => {
    for (let i = 0; i < 30; i++) rateLimit("ip2");
    expect(rateLimit("ip2")).toBe(false);
  });
});
