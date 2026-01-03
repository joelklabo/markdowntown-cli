import { describe, expect, it } from "vitest";
import { getDefaultCityWordmarkConfig, mergeCityWordmarkConfig } from "@/components/wordmark/sim/config";
import { createCityWordmarkLayout } from "@/components/wordmark/sim/layout";
import { spawnPedestrianActors } from "@/components/wordmark/sim/actors/pedestrian";

describe("spawnPedestrianActors", () => {
  it("spawns deterministically for a given seed", () => {
    const layout = createCityWordmarkLayout();
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "dense",
      timeOfDay: 0.55,
    });

    const a = spawnPedestrianActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 1234, config, layout }));
    const b = spawnPedestrianActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 1234, config, layout }));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("moves over time along a short loop path", () => {
    const layout = createCityWordmarkLayout();
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "dense", timeOfDay: 0.55 });

    const a = spawnPedestrianActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 0, config, layout }));
    const b = spawnPedestrianActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 5000, config, layout }));

    const bodyXs = (rects: typeof a) => rects.filter((r) => r.tone === "pedestrian" && r.opacity === 0.85).map((r) => r.x);
    expect(bodyXs(a)).not.toEqual(bodyXs(b));
  });

  it("renders dogs only when enabled", () => {
    const layout = createCityWordmarkLayout();
    const base = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "dense", timeOfDay: 0.55 });

    const noDogs = mergeCityWordmarkConfig(base, { actors: { dogs: false } });
    const withDogs = mergeCityWordmarkConfig(base, { actors: { dogs: true } });

    const a = spawnPedestrianActors({ config: noDogs, layout }).flatMap((actor) => actor.render({ nowMs: 0, config: noDogs, layout }));
    const b = spawnPedestrianActors({ config: withDogs, layout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config: withDogs, layout })
    );

    expect(a.some((r) => r.tone === "dog")).toBe(false);
    expect(b.some((r) => r.tone === "dog")).toBe(true);
  });

  it("respects config.actors.pedestrians", () => {
    const layout = createCityWordmarkLayout();
    const config = getDefaultCityWordmarkConfig();
    const disabled = { ...config, actors: { ...config.actors, pedestrians: false } };
    expect(spawnPedestrianActors({ config: disabled, layout })).toEqual([]);
  });

  it("renders taller HD silhouettes when detail is hd", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "dense",
      timeOfDay: 0.55,
    });
    const standardLayout = createCityWordmarkLayout({ detail: "standard" });
    const hdLayout = createCityWordmarkLayout({ detail: "hd" });

    const standardRects = spawnPedestrianActors({ config, layout: standardLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: standardLayout })
    );
    const hdRects = spawnPedestrianActors({ config, layout: hdLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: hdLayout })
    );

    const standardPed = standardRects.filter((r) => r.tone === "pedestrian");
    const hdPed = hdRects.filter((r) => r.tone === "pedestrian");

    expect(standardPed.length).toBeGreaterThan(0);
    expect(hdPed.length).toBeGreaterThan(standardPed.length);

    const standardHeight =
      Math.max(...standardPed.map((r) => r.y + r.height)) - Math.min(...standardPed.map((r) => r.y));
    const hdHeight = Math.max(...hdPed.map((r) => r.y + r.height)) - Math.min(...hdPed.map((r) => r.y));
    expect(hdHeight).toBeGreaterThan(standardHeight);
  });

  it("scales geometry with voxel resolution", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "dense",
      timeOfDay: 0.55,
    });
    const baseLayout = createCityWordmarkLayout({ resolution: 1 });
    const scaledLayout = createCityWordmarkLayout({ resolution: 3 });

    const baseRects = spawnPedestrianActors({ config, layout: baseLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: baseLayout })
    );
    const scaledRects = spawnPedestrianActors({ config, layout: scaledLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: scaledLayout })
    );

    const basePed = baseRects.filter((r) => r.tone === "pedestrian");
    const scaledPed = scaledRects.filter((r) => r.tone === "pedestrian");

    expect(basePed.length).toBeGreaterThan(0);
    expect(scaledPed.length).toBeGreaterThan(0);

    const baseHeight = Math.max(...basePed.map((r) => r.y + r.height)) - Math.min(...basePed.map((r) => r.y));
    const scaledHeight = Math.max(...scaledPed.map((r) => r.y + r.height)) - Math.min(...scaledPed.map((r) => r.y));
    expect(scaledHeight).toBeGreaterThan(baseHeight);
  });
});
