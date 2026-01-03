import { describe, expect, it } from "vitest";
import {
  CITY_WORDMARK_SCHEME_DEFINITIONS,
  getCityWordmarkPalette,
} from "@/components/wordmark/sim/palette";
import type { Rgb } from "@/components/wordmark/sim/color";
import type { CityWordmarkScheme } from "@/components/wordmark/sim/types";

function midpointRgb(a: Rgb, b: Rgb): Rgb {
  return [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), Math.round((a[2] + b[2]) / 2)] as const;
}

describe("getCityWordmarkPalette", () => {
  it("returns the scheme night palette at midnight", () => {
    for (const scheme of Object.keys(CITY_WORDMARK_SCHEME_DEFINITIONS) as CityWordmarkScheme[]) {
      const definition = CITY_WORDMARK_SCHEME_DEFINITIONS[scheme];
      expect(getCityWordmarkPalette(0, scheme)).toEqual(definition.night);
    }
  });

  it("returns the scheme day palette at noon", () => {
    for (const scheme of Object.keys(CITY_WORDMARK_SCHEME_DEFINITIONS) as CityWordmarkScheme[]) {
      const definition = CITY_WORDMARK_SCHEME_DEFINITIONS[scheme];
      expect(getCityWordmarkPalette(0.5, scheme)).toEqual(definition.day);
    }
  });

  it("interpolates classic at sunrise/sunset (midpoint)", () => {
    const definition = CITY_WORDMARK_SCHEME_DEFINITIONS.classic;
    const midpoint = {
      sky: midpointRgb(definition.night.sky, definition.day.sky),
      ground: midpointRgb(definition.night.ground, definition.day.ground),
      building: midpointRgb(definition.night.building, definition.day.building),
      buildingMuted: midpointRgb(definition.night.buildingMuted, definition.day.buildingMuted),
      window: midpointRgb(definition.night.window, definition.day.window),
      car: midpointRgb(definition.night.car, definition.day.car),
      star: midpointRgb(definition.night.star, definition.day.star),
      sun: midpointRgb(definition.night.sun, definition.day.sun),
      moon: midpointRgb(definition.night.moon, definition.day.moon),
    };

    expect(getCityWordmarkPalette(0.25, "classic")).toEqual(midpoint);
    expect(getCityWordmarkPalette(0.75, "classic")).toEqual(midpoint);
  });
});
