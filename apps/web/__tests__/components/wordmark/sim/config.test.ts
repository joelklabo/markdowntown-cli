import { describe, expect, it } from "vitest";
import { getDefaultCityWordmarkConfig, mergeCityWordmarkConfig } from "@/components/wordmark/sim/config";

describe("city wordmark config", () => {
  it("parses defaults including new tuning fields", () => {
    const config = getDefaultCityWordmarkConfig();
    expect(config.render.voxelScale).toBe(3);
    expect(config.render.bannerScale).toBe(1);
    expect(config.render.detail).toBe("hd");
    expect(config.scheme).toBe("classic");
    expect(config.skyline).toEqual({
      minHeight: 2,
      maxHeight: 6,
      minSegmentWidth: 2,
      maxSegmentWidth: 6,
    });
    expect(config.actors.trucks).toBe(false);
  });

  it("deep-merges nested overrides", () => {
    const base = getDefaultCityWordmarkConfig();
    const next = mergeCityWordmarkConfig(base, {
      render: { voxelScale: 6, bannerScale: 4, detail: "standard" },
      skyline: { maxHeight: 10 },
      actors: { trucks: true },
      scheme: "noir",
    });

    expect(next.render.voxelScale).toBe(6);
    expect(next.render.bannerScale).toBe(4);
    expect(next.render.detail).toBe("standard");
    expect(next.skyline.minHeight).toBe(base.skyline.minHeight);
    expect(next.skyline.maxHeight).toBe(10);
    expect(next.actors.trucks).toBe(true);
    expect(next.scheme).toBe("noir");
  });

  it("rejects invalid skyline ranges", () => {
    const base = getDefaultCityWordmarkConfig();
    expect(() =>
      mergeCityWordmarkConfig(base, {
        skyline: { minHeight: 8, maxHeight: 2 },
      })
    ).toThrow();
  });

  it("rejects invalid render scale", () => {
    const base = getDefaultCityWordmarkConfig();
    expect(() => mergeCityWordmarkConfig(base, { render: { voxelScale: 0 } })).toThrow();
    expect(() => mergeCityWordmarkConfig(base, { render: { bannerScale: 0 } })).toThrow();
  });
});
