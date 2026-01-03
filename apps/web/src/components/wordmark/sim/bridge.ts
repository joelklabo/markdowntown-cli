import { featureFlags } from "@/lib/flags";
import { dispatchCityWordmarkEvent } from "./events";
import type { CityWordmarkEvent } from "./types";
import { parseCityWordmarkEvent } from "./types";

export function emitCityWordmarkEvent(event: CityWordmarkEvent) {
  if (!featureFlags.wordmarkAnimV1 || !featureFlags.wordmarkBannerV1) return;
  if (typeof window === "undefined") return;

  let normalized: CityWordmarkEvent = event;
  if (event.type === "search") {
    const query = event.query.trim();
    if (!query) return;
    normalized = { ...event, query };
  }

  const withTs: CityWordmarkEvent = { ...normalized, ts: event.ts ?? Date.now() };
  const parsed = parseCityWordmarkEvent(withTs);
  if (!parsed) return;

  dispatchCityWordmarkEvent(parsed);
}
