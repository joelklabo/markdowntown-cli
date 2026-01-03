const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;

const buckets = new Map<string, { count: number; expires: number }>();

export function rateLimit(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket && bucket.expires > now) {
    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) return false;
    return true;
  }
  buckets.set(key, { count: 1, expires: now + WINDOW_MS });
  return true;
}

export function resetRateLimitStore() {
  buckets.clear();
}
