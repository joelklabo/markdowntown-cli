import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rateLimiter";

describe("Rate Limiter", () => {
  it("should allow requests below the limit", async () => {
    resetRateLimitStore();
    const key = "127.0.0.1";
    const res = await checkRateLimit(key);
    expect(res).toBeNull();
  });

  it("should block requests that exceed the limit", async () => {
    resetRateLimitStore();
    const key = "127.0.0.1";

    for (let i = 0; i < 30; i++) {
      await checkRateLimit(key);
    }

    const res = await checkRateLimit(key);
    expect(res).not.toBeNull();
    if (res) {
      expect(res.status).toBe(429);
    }
  });

  it("should return a response with Retry-After header when limit is exceeded", async () => {
    resetRateLimitStore();
    const key = "127.0.0.1";

    for (let i = 0; i < 31; i++) {
      await checkRateLimit(key);
    }

    const res = await checkRateLimit(key);
    expect(res).not.toBeNull();
    if (res) {
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeDefined();
    }
  });
});
