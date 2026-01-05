import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rateLimiter";
import * as redisModule from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

vi.mock("@/lib/redis", () => ({
  redis: {
    limit: vi.fn(),
  },
  isRedisEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@upstash/ratelimit", () => {
  const RatelimitMock = vi.fn();
  (RatelimitMock as any).slidingWindow = vi.fn();
  return {
    Ratelimit: RatelimitMock,
  };
});

describe("rateLimiter", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.clearAllMocks();
    vi.mocked(redisModule.isRedisEnabled).mockReturnValue(true);
  });

  it("falls back to in-memory when Redis is not available", async () => {
    vi.mocked(redisModule.isRedisEnabled).mockReturnValue(false);
    
    // Test in-memory logic
    const options = { maxRequests: 2, windowMs: 1000 };
    expect(await checkRateLimit("test-key", options)).toBeNull();
    expect(await checkRateLimit("test-key", options)).toBeNull();
    const response = await checkRateLimit("test-key", options);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    const body = await response?.json();
    expect(body.error).toBe("Too many requests (fallback)");
  });

  it("uses Redis when available", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      reset: Date.now() + 1000,
      remaining: 9,
    });
    
    vi.mocked(Ratelimit).mockImplementation(function() {
      return {
        limit: limitMock,
      };
    } as any);

    const response = await checkRateLimit("redis-key", { maxRequests: 10, windowMs: 1000 });
    expect(response).toBeNull();
    expect(limitMock).toHaveBeenCalledWith("redis-key");
  });

  it("returns 429 when Redis limit exceeded", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      success: false,
      limit: 10,
      reset: Date.now() + 1000,
      remaining: 0,
    });
    
    vi.mocked(Ratelimit).mockImplementation(function() {
      return {
        limit: limitMock,
      };
    } as any);

    const response = await checkRateLimit("exceeded-key", { maxRequests: 10, windowMs: 1000 });
    expect(response?.status).toBe(429);
    const body = await response?.json();
    expect(body.error).toBe("Too many requests");
  });

  it("falls back to in-memory if Redis throws", async () => {
    vi.mocked(Ratelimit).mockImplementation(function() {
      return {
        limit: vi.fn().mockRejectedValue(new Error("Redis down")),
      };
    } as any);

    // Should fall back to in-memory and succeed first call
    const response = await checkRateLimit("fallback-key", { maxRequests: 1, windowMs: 1000 });
    expect(response).toBeNull();
  });

  it("cleans up expired keys in fallback mode", async () => {
    vi.mocked(redisModule.isRedisEnabled).mockReturnValue(false);
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    // Create an entry that will expire
    await checkRateLimit("to-expire", { maxRequests: 1, windowMs: 1000 });
    
    // It should fail now
    const failResp = await checkRateLimit("to-expire", { maxRequests: 1, windowMs: 1000 });
    expect(failResp?.status).toBe(429);

    // Advance time
    vi.advanceTimersByTime(1001);

    // Should succeed now
    const successResp = await checkRateLimit("to-expire", { maxRequests: 1, windowMs: 1000 });
    expect(successResp).toBeNull();

    vi.useRealTimers();
  });
});
