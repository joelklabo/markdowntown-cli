const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;

export const CLI_UPLOAD_LIMITS = {
  handshake: { windowMs: WINDOW_MS, maxRequests: 30 },
  blob: { windowMs: WINDOW_MS, maxRequests: 300 },
  complete: { windowMs: WINDOW_MS, maxRequests: 60 },
};

type RateLimitOptions = {
  windowMs?: number;
  maxRequests?: number;
};

const buckets = new Map<string, { count: number; expires: number; windowMs: number; maxRequests: number }>();

export function rateLimit(key: string, options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const maxRequests = options.maxRequests ?? MAX_REQUESTS;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket && bucket.expires > now && bucket.windowMs === windowMs && bucket.maxRequests === maxRequests) {
    bucket.count += 1;
    if (bucket.count > maxRequests) return false;
    return true;
  }
  buckets.set(key, { count: 1, expires: now + windowMs, windowMs, maxRequests });
  return true;
}

export function resetRateLimitStore() {
  buckets.clear();
}
