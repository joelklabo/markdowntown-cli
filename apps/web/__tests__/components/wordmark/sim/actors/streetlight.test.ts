import { describe, expect, it } from "vitest";
import { getDefaultCityWordmarkConfig, mergeCityWordmarkConfig } from "@/components/wordmark/sim/config";
import { createCityWordmarkLayout } from "@/components/wordmark/sim/layout";
import { spawnStreetlightActors } from "@/components/wordmark/sim/actors/streetlight";

describe("spawnStreetlightActors", () => {
  it("spawns deterministically for a given seed", () => {
    const layout = createCityWordmarkLayout();
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "dense",
      timeOfDay: 0.04,
    });

    const a = spawnStreetlightActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 1234, config, layout }));
    const b = spawnStreetlightActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 1234, config, layout }));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("does not render during the day", () => {
    const layout = createCityWordmarkLayout();
    const base = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "normal" });

    const dayConfig = mergeCityWordmarkConfig(base, { timeOfDay: 0.55 });
    const nightConfig = mergeCityWordmarkConfig(base, { timeOfDay: 0.04 });

    const dayRects = spawnStreetlightActors({ config: dayConfig, layout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config: dayConfig, layout })
    );
    const nightRects = spawnStreetlightActors({ config: nightConfig, layout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config: nightConfig, layout })
    );

    expect(dayRects).toEqual([]);
    expect(nightRects.length).toBeGreaterThan(0);
  });

  it("respects config.actors.streetlights", () => {
    const layout = createCityWordmarkLayout();
    const config = getDefaultCityWordmarkConfig();
    const disabled = { ...config, actors: { ...config.actors, streetlights: false } };
    expect(spawnStreetlightActors({ config: disabled, layout })).toEqual([]);
  });

  it("renders HD poles when detail is hd", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "dense",
      timeOfDay: 0.04,
    });
    const standardLayout = createCityWordmarkLayout({ detail: "standard" });
    const hdLayout = createCityWordmarkLayout({ detail: "hd" });

    const standardRects = spawnStreetlightActors({ config, layout: standardLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: standardLayout })
    );
    const hdRects = spawnStreetlightActors({ config, layout: hdLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: hdLayout })
    );

    expect(standardRects.length).toBeGreaterThan(0);
    expect(hdRects.length).toBeGreaterThan(standardRects.length);
  });

  it("scales geometry with voxel resolution", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "dense",
      timeOfDay: 0.04,
    });
    const baseLayout = createCityWordmarkLayout({ resolution: 1 });
    const scaledLayout = createCityWordmarkLayout({ resolution: 3 });

    const baseRects = spawnStreetlightActors({ config, layout: baseLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: baseLayout })
    );
    const scaledRects = spawnStreetlightActors({ config, layout: scaledLayout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config, layout: scaledLayout })
    );

    expect(baseRects.length).toBeGreaterThan(0);
    expect(scaledRects.length).toBeGreaterThan(0);

    const baseHeight = Math.max(...baseRects.map((r) => r.y + r.height)) - Math.min(...baseRects.map((r) => r.y));
    const scaledHeight = Math.max(...scaledRects.map((r) => r.y + r.height)) - Math.min(...scaledRects.map((r) => r.y));
    expect(scaledHeight).toBeGreaterThan(baseHeight);
  });
});
