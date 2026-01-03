import { featureFlags } from "@/lib/flags";
import { getPrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import type { CityWordmarkEvent } from "./types";
import { parseCityWordmarkEvent } from "./types";

export const CITY_WORDMARK_EVENT = "mdt:city-wordmark:event";

export type CityWordmarkEventListener = (event: CityWordmarkEvent) => void;

const EVENT_RATE_WINDOW_MS = 1000;
const EVENT_RATE_MAX = 12;

function createRateLimiter(windowMs: number, max: number) {
  const windows = new Map<string, { start: number; count: number }>();

  return (key: string, now: number) => {
    const entry = windows.get(key) ?? { start: 0, count: 0 };
    if (entry.start === 0 || now - entry.start > windowMs) {
      entry.start = now;
      entry.count = 0;
    }
    entry.count += 1;
    windows.set(key, entry);
    return entry.count > max;
  };
}

const isDispatchRateLimited = createRateLimiter(EVENT_RATE_WINDOW_MS, EVENT_RATE_MAX);
const isListenerRateLimited = createRateLimiter(EVENT_RATE_WINDOW_MS, EVENT_RATE_MAX);

function normalizeEventTs(ts?: number): number {
  const value = typeof ts === "number" && Number.isFinite(ts) ? ts : Date.now();
  return value;
}

export function dispatchCityWordmarkEvent(event: CityWordmarkEvent) {
  if (typeof window === "undefined") return;
  if (getPrefersReducedMotion()) return;
  if (!featureFlags.wordmarkAnimV1 || !featureFlags.wordmarkBannerV1) return;
  const parsed = parseCityWordmarkEvent(event);
  if (!parsed) return;
  const ts = normalizeEventTs(parsed.ts);
  if (isDispatchRateLimited(parsed.type, Date.now())) return;
  window.dispatchEvent(new CustomEvent<CityWordmarkEvent>(CITY_WORDMARK_EVENT, { detail: { ...parsed, ts } }));
}

export function listenCityWordmarkEvents(listener: CityWordmarkEventListener) {
  if (typeof window === "undefined") return () => {};
  if (!featureFlags.wordmarkAnimV1 || !featureFlags.wordmarkBannerV1) return () => {};

  function onEvent(e: Event) {
    if (!(e instanceof CustomEvent)) return;
    const detail = parseCityWordmarkEvent(e.detail);
    if (!detail) return;
    const ts = normalizeEventTs(detail.ts);
    if (isListenerRateLimited(detail.type, Date.now())) return;
    listener({ ...detail, ts });
  }

  window.addEventListener(CITY_WORDMARK_EVENT, onEvent);
  return () => window.removeEventListener(CITY_WORDMARK_EVENT, onEvent);
}
