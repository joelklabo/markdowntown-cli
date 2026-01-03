import { describe, expect, it } from "vitest";
import { getDefaultCityWordmarkConfig, mergeCityWordmarkConfig } from "@/components/wordmark/sim/config";
import { createCityWordmarkLayout } from "@/components/wordmark/sim/layout";
import { spawnAmbulanceActor } from "@/components/wordmark/sim/actors/ambulance";

describe("spawnAmbulanceActor", () => {
  it("spawns deterministically for a given seed + triggerIndex", () => {
    const layout = createCityWordmarkLayout();
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "normal" });

    const a = spawnAmbulanceActor({ config, layout, nowMs: 1000, triggerIndex: 0 })?.render({ nowMs: 1234, config, layout });
    const b = spawnAmbulanceActor({ config, layout, nowMs: 1000, triggerIndex: 0 })?.render({ nowMs: 1234, config, layout });
    expect(a).toEqual(b);
    expect(a?.length ?? 0).toBeGreaterThan(0);
  });

  it("flashes siren lights over time", () => {
    const layout = createCityWordmarkLayout();
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "normal" });
    const actor = spawnAmbulanceActor({ config, layout, nowMs: 0, triggerIndex: 0 });
    expect(actor).not.toBeNull();
    if (!actor) return;

    const a = actor.render({ nowMs: 0, config, layout });
    const b = actor.render({ nowMs: 250, config, layout });

    const aRed = a.find((r) => r.tone === "sirenRed");
    const aBlue = a.find((r) => r.tone === "sirenBlue");
    const bRed = b.find((r) => r.tone === "sirenRed");
    const bBlue = b.find((r) => r.tone === "sirenBlue");

    expect(aRed?.opacity ?? 0).toBeGreaterThan(aBlue?.opacity ?? 0);
    expect(bBlue?.opacity ?? 0).toBeGreaterThan(bRed?.opacity ?? 0);
  });

  it("respects config.actors.ambulance", () => {
    const layout = createCityWordmarkLayout();
    const config = getDefaultCityWordmarkConfig();
    const disabled = { ...config, actors: { ...config.actors, ambulance: false } };
    expect(spawnAmbulanceActor({ config: disabled, layout, nowMs: 0, triggerIndex: 0 })).toBeNull();
  });

  it("renders a taller HD profile when detail is hd", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "normal" });
    const standardLayout = createCityWordmarkLayout({ detail: "standard" });
    const hdLayout = createCityWordmarkLayout({ detail: "hd" });

    const standardActor = spawnAmbulanceActor({ config, layout: standardLayout, nowMs: 0, triggerIndex: 0 });
    const hdActor = spawnAmbulanceActor({ config, layout: hdLayout, nowMs: 0, triggerIndex: 0 });

    expect(standardActor).not.toBeNull();
    expect(hdActor).not.toBeNull();
    if (!standardActor || !hdActor) return;

    const standardRects = standardActor.render({ nowMs: 0, config, layout: standardLayout });
    const hdRects = hdActor.render({ nowMs: 0, config, layout: hdLayout });

    expect(hdRects.length).toBeGreaterThan(standardRects.length);

    const standardHeight =
      Math.max(...standardRects.map((r) => r.y + r.height)) - Math.min(...standardRects.map((r) => r.y));
    const hdHeight = Math.max(...hdRects.map((r) => r.y + r.height)) - Math.min(...hdRects.map((r) => r.y));
    expect(hdHeight).toBeGreaterThan(standardHeight);
  });

  it("scales geometry with voxel resolution", () => {
    const config = mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), { seed: "seed", density: "normal" });
    const baseLayout = createCityWordmarkLayout({ resolution: 1 });
    const scaledLayout = createCityWordmarkLayout({ resolution: 3 });

    const baseActor = spawnAmbulanceActor({ config, layout: baseLayout, nowMs: 0, triggerIndex: 0 });
    const scaledActor = spawnAmbulanceActor({ config, layout: scaledLayout, nowMs: 0, triggerIndex: 0 });

    expect(baseActor).not.toBeNull();
    expect(scaledActor).not.toBeNull();
    if (!baseActor || !scaledActor) return;

    const baseRects = baseActor.render({ nowMs: 0, config, layout: baseLayout });
    const scaledRects = scaledActor.render({ nowMs: 0, config, layout: scaledLayout });

    const baseHeight = Math.max(...baseRects.map((r) => r.y + r.height)) - Math.min(...baseRects.map((r) => r.y));
    const scaledHeight = Math.max(...scaledRects.map((r) => r.y + r.height)) - Math.min(...scaledRects.map((r) => r.y));
    expect(scaledHeight).toBeGreaterThan(baseHeight);
  });
});
