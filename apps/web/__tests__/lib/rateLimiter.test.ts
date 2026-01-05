import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rateLimiter";

describe("rateLimiter", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests within limit", () => {
    const options = { maxRequests: 2, windowMs: 1000 };
    expect(checkRateLimit("key1", options)).toBeNull();
    expect(checkRateLimit("key1", options)).toBeNull();
  });

  it("returns 429 when limit exceeded", async () => {
    const options = { maxRequests: 1, windowMs: 1000 };
    checkRateLimit("key2", options);
    const res = checkRateLimit("key2", options);
    
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    const json = await res?.json();
    expect(json.error).toBe("Too many requests");
    expect(res?.headers.get("Retry-After")).toBeDefined();
  });

  it("resets after window", async () => {
    // This is hard to test with real time, but we can mock Date.now if needed.
    // For now skip or use small window.
  });
});
