import { describe, expect, it } from "vitest";
import { getDefaultCityWordmarkConfig, mergeCityWordmarkConfig } from "@/components/wordmark/sim/config";
import { createCityWordmarkLayout } from "@/components/wordmark/sim/layout";
import { spawnCarActors } from "@/components/wordmark/sim/actors/car";

describe("spawnCarActors", () => {
  it("spawns deterministically for a given seed", () => {
    const layout = createCityWordmarkLayout();
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "dense",
      timeOfDay: 0.9,
    });

    const a = spawnCarActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 1234, config, layout }));
    const b = spawnCarActors({ config, layout }).flatMap((actor) => actor.render({ nowMs: 1234, config, layout }));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("does not render headlights during the day", () => {
    const layout = createCityWordmarkLayout();
    const base = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "normal" });

    const dayConfig = mergeCityWordmarkConfig(base, { timeOfDay: 0.5 });
    const nightConfig = mergeCityWordmarkConfig(base, { timeOfDay: 0.9 });

    const dayRects = spawnCarActors({ config: dayConfig, layout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config: dayConfig, layout })
    );
    const nightRects = spawnCarActors({ config: nightConfig, layout }).flatMap((actor) =>
      actor.render({ nowMs: 0, config: nightConfig, layout })
    );

    expect(dayRects.some((r) => r.tone === "headlight")).toBe(false);
    expect(nightRects.some((r) => r.tone === "headlight")).toBe(true);
  });

  it("respects config.actors.cars", () => {
    const layout = createCityWordmarkLayout();
    const config = getDefaultCityWordmarkConfig();
    const disabled = { ...config, actors: { ...config.actors, cars: false } };
    expect(spawnCarActors({ config: disabled, layout })).toEqual([]);
  });

  it("renders a taller HD profile when detail is hd", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "normal",
      timeOfDay: 0.9,
    });
    const standardLayout = createCityWordmarkLayout({ detail: "standard" });
    const hdLayout = createCityWordmarkLayout({ detail: "hd" });

    const standardActor = spawnCarActors({ config, layout: standardLayout })[0];
    const hdActor = spawnCarActors({ config, layout: hdLayout })[0];

    const standardRects = standardActor?.render({ nowMs: 0, config, layout: standardLayout }) ?? [];
    const hdRects = hdActor?.render({ nowMs: 0, config, layout: hdLayout }) ?? [];

    expect(standardRects.length).toBeGreaterThan(0);
    expect(hdRects.length).toBeGreaterThan(standardRects.length);

    const standardHeight =
      Math.max(...standardRects.map((r) => r.y + r.height)) - Math.min(...standardRects.map((r) => r.y));
    const hdHeight = Math.max(...hdRects.map((r) => r.y + r.height)) - Math.min(...hdRects.map((r) => r.y));
    expect(hdHeight).toBeGreaterThan(standardHeight);
  });

  it("scales geometry with voxel resolution", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), {
      seed: "seed",
      density: "normal",
      timeOfDay: 0.9,
    });
    const baseLayout = createCityWordmarkLayout({ resolution: 1 });
    const scaledLayout = createCityWordmarkLayout({ resolution: 3 });

    const baseRects = spawnCarActors({ config, layout: baseLayout })[0]?.render({ nowMs: 0, config, layout: baseLayout }) ?? [];
    const scaledRects = spawnCarActors({ config, layout: scaledLayout })[0]?.render({ nowMs: 0, config, layout: scaledLayout }) ?? [];

    expect(baseRects.length).toBeGreaterThan(0);
    expect(scaledRects.length).toBeGreaterThan(0);

    const baseHeight = Math.max(...baseRects.map((r) => r.y + r.height)) - Math.min(...baseRects.map((r) => r.y));
    const scaledHeight = Math.max(...scaledRects.map((r) => r.y + r.height)) - Math.min(...scaledRects.map((r) => r.y));
    expect(scaledHeight).toBeGreaterThan(baseHeight);
  });
});
