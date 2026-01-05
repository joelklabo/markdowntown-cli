import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { redis, isRedisEnabled } from "./redis";

// --- Configuration ---
const WINDOW_MS = numberFromEnv("RATELIMIT_WINDOW_MS", 60 * 1000); // 1 minute default
const MAX_REQUESTS = numberFromEnv("RATELIMIT_MAX_REQUESTS", 30);
const FALLBACK_MAX_KEYS = 10000; // Hard cap on fallback map size

function numberFromEnv(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val) {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

export const CLI_UPLOAD_LIMITS = {
  handshake: { windowMs: WINDOW_MS, maxRequests: 30 },
  blob: { windowMs: WINDOW_MS, maxRequests: 300 },
  complete: { windowMs: WINDOW_MS, maxRequests: 60 },
};

export const CLI_SNAPSHOT_LIMITS = {
  list: { windowMs: WINDOW_MS, maxRequests: 120 },
  create: { windowMs: WINDOW_MS, maxRequests: 30 },
  files: { windowMs: WINDOW_MS, maxRequests: 240 },
};

type RateLimitOptions = {
  windowMs?: number;
  maxRequests?: number;
  points?: number;
  duration?: number;
};

// --- In-Memory Fallback ---
const buckets = new Map<
  string,
  { count: number; expires: number; windowMs: number; maxRequests: number }
>();

// cleanupExpired removes expired entries to prevent memory leaks
function cleanupExpired() {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.expires <= now) {
      buckets.delete(key);
    }
  }
}

// --- Rate Limiter Instance ---
// Create a map of limiters to avoid re-instantiating on every request
// Key format: `${windowMs}:${maxRequests}`
const limiters = new Map<string, Ratelimit>();

function getRatelimit(windowMs: number, maxRequests: number): Ratelimit | null {
  if (!isRedisEnabled() || !redis) return null;
  
  const key = `${windowMs}:${maxRequests}`;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      analytics: true,
      prefix: "@upstash/ratelimit",
    }));
  }
  return limiters.get(key)!;
}

/**
 * Rate limiting policy:
 * 1. Primary: Upstash Redis (distributed).
 * 2. Fallback: In-memory Map (per-instance) with OOM protection.
 * 3. Fail-policy: Fail-open to in-memory.
 */
export async function checkRateLimit(key: string, options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? options.duration ?? WINDOW_MS;
  const maxRequests = options.maxRequests ?? options.points ?? MAX_REQUESTS;
  const now = Date.now();

  // 1. Try Redis
  try {
    const ratelimit = getRatelimit(windowMs, maxRequests);
    if (ratelimit) {
      const { success, limit, reset, remaining } = await ratelimit.limit(key);

      if (!success) {
        const retryAfter = Math.ceil((reset - now) / 1000);
        return NextResponse.json(
          { error: "Too many requests", limit, remaining },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Remaining": String(remaining),
              "X-RateLimit-Reset": String(reset),
            },
          }
        );
      }
      return null;
    }
  } catch (error) {
    console.error("Redis rate limit error, falling back to in-memory:", error);
    // Fall through to fallback
  }

  // 2. In-Memory Fallback
  let bucket = buckets.get(key);

  // Lazy cleanup if map is getting too big
  if (!bucket && buckets.size >= FALLBACK_MAX_KEYS) {
    cleanupExpired();
    // If still full, fail-safe by clearing to prioritize service availability over strict limiting
    if (buckets.size >= FALLBACK_MAX_KEYS) {
      console.warn("Rate limit fallback bucket full, clearing all to prevent OOM");
      buckets.clear();
    }
  }

  // Check if existing bucket is valid
  if (bucket) {
    if (bucket.expires <= now) {
      // Expired, delete it effectively by letting it be overwritten below
      buckets.delete(key);
      bucket = undefined; 
    } else if (
       bucket.windowMs === windowMs &&
       bucket.maxRequests === maxRequests
    ) {
      // Valid bucket, increment
      bucket.count += 1;
      if (bucket.count > maxRequests) {
        const retryAfter = Math.ceil((bucket.expires - now) / 1000);
        return NextResponse.json(
          { error: "Too many requests (fallback)" },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          }
        );
      }
      return null;
    }
  }

  // Create new bucket
  buckets.set(key, {
    count: 1,
    expires: now + windowMs,
    windowMs,
    maxRequests,
  });
  return null;
}

export async function rateLimit(key: string, options: RateLimitOptions = {}) {
  const response = await checkRateLimit(key, options);
  return response === null;
}

export function resetRateLimitStore() {
  buckets.clear();
  limiters.clear();
}