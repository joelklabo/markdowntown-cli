import { NextResponse } from "next/server";

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;

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
};

const buckets = new Map<
  string,
  { count: number; expires: number; windowMs: number; maxRequests: number }
>();

export function rateLimit(key: string, options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const maxRequests = options.maxRequests ?? MAX_REQUESTS;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (
    bucket &&
    bucket.expires > now &&
    bucket.windowMs === windowMs &&
    bucket.maxRequests === maxRequests
  ) {
    bucket.count += 1;
    return bucket.count <= maxRequests;
  }
  buckets.set(key, {
    count: 1,
    expires: now + windowMs,
    windowMs,
    maxRequests,
  });
  return true;
}

export function checkRateLimit(key: string, options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const maxRequests = options.maxRequests ?? MAX_REQUESTS;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (
    bucket &&
    bucket.expires > now &&
    bucket.windowMs === windowMs &&
    bucket.maxRequests === maxRequests
  ) {
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      const retryAfter = Math.ceil((bucket.expires - now) / 1000);
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
          },
        }
      );
    }
    return null;
  }

  buckets.set(key, {
    count: 1,
    expires: now + windowMs,
    windowMs,
    maxRequests,
  });
  return null;
}

export function resetRateLimitStore() {
  buckets.clear();
}