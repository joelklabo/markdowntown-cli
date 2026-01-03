import { describe, expect, it } from "vitest";
import { dispatchCityWordmarkEvent } from "@/components/wordmark/sim/events";
import {
  getCityWordmarkEngineSnapshot,
  setCityWordmarkEngineConfig,
  setCityWordmarkEnginePlaying,
  subscribeCityWordmarkEngine,
} from "@/components/wordmark/sim/engine";

const DISABLED_ACTORS = {
  cars: false,
  trucks: false,
  streetlights: false,
  pedestrians: false,
  dogs: false,
  ambulance: false,
} as const;

function resetEngine() {
  setCityWordmarkEnginePlaying(false);
  setCityWordmarkEngineConfig({
    seed: "seed",
    density: "normal",
    actors: { ...DISABLED_ACTORS },
  });
}

describe("CityWordmark engine events", () => {
  it("spawns an ambulance actor on alert events", () => {
    resetEngine();
    setCityWordmarkEngineConfig({ actors: { ...DISABLED_ACTORS, ambulance: true } });

    const unsubscribe = subscribeCityWordmarkEngine(() => {});
    dispatchCityWordmarkEvent({ type: "alert", kind: "ambulance", ts: 1 });

    const snapshot = getCityWordmarkEngineSnapshot();
    expect(snapshot.actorRects.some((r) => r.tone === "sirenRed")).toBe(true);
    expect(snapshot.actorRects.some((r) => r.tone === "sirenBlue")).toBe(true);

    unsubscribe();
  });

  it("ignores malformed events safely", () => {
    resetEngine();

    const unsubscribe = subscribeCityWordmarkEngine(() => {});
    const before = getCityWordmarkEngineSnapshot();

    dispatchCityWordmarkEvent({ type: "search" } as unknown as never);
    dispatchCityWordmarkEvent({ type: "unknown", ts: 1 } as unknown as never);

    const after = getCityWordmarkEngineSnapshot();
    expect(after.actorRects).toEqual(before.actorRects);

    unsubscribe();
  });

  it("spawns event actors for search and upload triggers", () => {
    resetEngine();
    const unsubscribe = subscribeCityWordmarkEngine(() => {});

    dispatchCityWordmarkEvent({ type: "search", query: "city", ts: 1000 });
    let snapshot = getCityWordmarkEngineSnapshot();
    expect(snapshot.actorRects.some((r) => r.tone === "car")).toBe(true);

    resetEngine();
    dispatchCityWordmarkEvent({ type: "upload", kind: "file", ts: 2600 });
    snapshot = getCityWordmarkEngineSnapshot();
    expect(snapshot.actorRects.some((r) => r.tone === "dog")).toBe(true);

    unsubscribe();
  });

  it("spawns pedestrian actors for command palette and login events", () => {
    resetEngine();
    const unsubscribe = subscribeCityWordmarkEngine(() => {});

    dispatchCityWordmarkEvent({ type: "command_palette_open", ts: 1400 });
    let snapshot = getCityWordmarkEngineSnapshot();
    expect(snapshot.actorRects.some((r) => r.tone === "pedestrian")).toBe(true);

    resetEngine();
    dispatchCityWordmarkEvent({ type: "login", method: "oauth", ts: 2200 });
    snapshot = getCityWordmarkEngineSnapshot();
    expect(snapshot.actorRects.some((r) => r.tone === "pedestrian")).toBe(true);

    unsubscribe();
  });

  it("throttles repeated events within the cooldown window", () => {
    resetEngine();
    const unsubscribe = subscribeCityWordmarkEngine(() => {});

    dispatchCityWordmarkEvent({ type: "search", query: "rush", ts: 4000 });
    const afterFirst = getCityWordmarkEngineSnapshot();

    dispatchCityWordmarkEvent({ type: "search", query: "rush", ts: 4500 });
    const afterSecond = getCityWordmarkEngineSnapshot();

    expect(afterSecond.actorRects).toEqual(afterFirst.actorRects);

    unsubscribe();
  });

  it("produces deterministic event actors for fixed seeds", () => {
    resetEngine();
    const unsubscribe = subscribeCityWordmarkEngine(() => {});

    dispatchCityWordmarkEvent({ type: "publish", kind: "artifact", ts: 7200 });
    const first = getCityWordmarkEngineSnapshot().actorRects;

    resetEngine();
    dispatchCityWordmarkEvent({ type: "publish", kind: "artifact", ts: 7200 });
    const second = getCityWordmarkEngineSnapshot().actorRects;

    expect(second).toEqual(first);

    unsubscribe();
  });
});
