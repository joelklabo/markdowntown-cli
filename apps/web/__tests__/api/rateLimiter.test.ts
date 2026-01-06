import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimitStore } from "@/lib/rateLimiter";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimitStore());

  it("allows up to the limit", async () => {
    let allowed = 0;
    for (let i = 0; i < 30; i++) {
      if (await rateLimit("ip1")) allowed++;
    }
    expect(allowed).toBe(30);
  });

  it("blocks after the limit", async () => {
    for (let i = 0; i < 30; i++) await rateLimit("ip2");
    expect(await rateLimit("ip2")).toBe(false);
  });
});
