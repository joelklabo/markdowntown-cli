import { getTimeOfDayPhase } from "./time";
import type { Rgb } from "./color";
import { lerpRgb } from "./color";
import type { CityWordmarkScheme } from "./types";

export type CityWordmarkPalette = {
  sky: Rgb;
  ground: Rgb;
  building: Rgb;
  buildingMuted: Rgb;
  window: Rgb;
  car: Rgb;
  star: Rgb;
  sun: Rgb;
  moon: Rgb;
};

const CLASSIC_NIGHT: CityWordmarkPalette = {
  sky: [8, 12, 24],
  ground: [16, 22, 18],
  building: [38, 54, 78],
  buildingMuted: [18, 28, 44],
  window: [255, 198, 86],
  car: [90, 110, 132],
  star: [228, 240, 255],
  sun: [255, 180, 90],
  moon: [210, 220, 240],
};

const CLASSIC_DAY: CityWordmarkPalette = {
  sky: [135, 206, 235],
  ground: [68, 140, 88],
  building: [28, 44, 68],
  buildingMuted: [64, 100, 138],
  window: [255, 240, 200],
  car: [56, 86, 112],
  star: [228, 240, 255],
  sun: [255, 230, 140],
  moon: [210, 220, 240],
};

export type CityWordmarkSchemeDefinition = Readonly<{
  scheme: CityWordmarkScheme;
  label: string;
  night: CityWordmarkPalette;
  day: CityWordmarkPalette;
}>;

export const CITY_WORDMARK_SCHEME_DEFINITIONS: Record<CityWordmarkScheme, CityWordmarkSchemeDefinition> = {
  classic: {
    scheme: "classic",
    label: "Classic",
    night: CLASSIC_NIGHT,
    day: CLASSIC_DAY,
  },
  noir: {
    scheme: "noir",
    label: "Noir",
    night: {
      sky: [6, 6, 10],
      ground: [12, 12, 14],
      building: [66, 70, 82],
      buildingMuted: [22, 24, 30],
      window: [255, 210, 140],
      car: [96, 98, 108],
      star: [228, 240, 255],
      sun: [240, 220, 180],
      moon: [210, 220, 240],
    },
    day: {
      sky: [212, 216, 224],
      ground: [124, 128, 132],
      building: [28, 32, 40],
      buildingMuted: [110, 118, 134],
      window: [255, 240, 200],
      car: [84, 86, 96],
      star: [228, 240, 255],
      sun: [255, 230, 140],
      moon: [210, 220, 240],
    },
  },
  neon: {
    scheme: "neon",
    label: "Neon",
    night: {
      sky: [10, 6, 28],
      ground: [18, 12, 38],
      building: [172, 86, 255],
      buildingMuted: [60, 24, 120],
      window: [54, 255, 214],
      car: [255, 84, 200],
      star: [228, 240, 255],
      sun: [255, 180, 120],
      moon: [210, 220, 240],
    },
    day: {
      sky: [154, 224, 255],
      ground: [98, 200, 168],
      building: [34, 10, 70],
      buildingMuted: [72, 32, 118],
      window: [120, 255, 232],
      car: [255, 84, 180],
      star: [228, 240, 255],
      sun: [255, 230, 160],
      moon: [210, 220, 240],
    },
  },
};

export const CITY_WORDMARK_SCHEME_OPTIONS: ReadonlyArray<{ value: CityWordmarkScheme; label: string }> = [
  { value: "classic", label: CITY_WORDMARK_SCHEME_DEFINITIONS.classic.label },
  { value: "noir", label: CITY_WORDMARK_SCHEME_DEFINITIONS.noir.label },
  { value: "neon", label: CITY_WORDMARK_SCHEME_DEFINITIONS.neon.label },
];

function lerpPalette(a: CityWordmarkPalette, b: CityWordmarkPalette, t: number): CityWordmarkPalette {
  return {
    sky: lerpRgb(a.sky, b.sky, t),
    ground: lerpRgb(a.ground, b.ground, t),
    building: lerpRgb(a.building, b.building, t),
    buildingMuted: lerpRgb(a.buildingMuted, b.buildingMuted, t),
    window: lerpRgb(a.window, b.window, t),
    car: lerpRgb(a.car, b.car, t),
    star: lerpRgb(a.star, b.star, t),
    sun: lerpRgb(a.sun, b.sun, t),
    moon: lerpRgb(a.moon, b.moon, t),
  };
}

export function getCityWordmarkPalette(timeOfDay: number, scheme: CityWordmarkScheme = "classic"): CityWordmarkPalette {
  const { daylight } = getTimeOfDayPhase(timeOfDay);
  const definition = CITY_WORDMARK_SCHEME_DEFINITIONS[scheme] ?? CITY_WORDMARK_SCHEME_DEFINITIONS.classic;
  return lerpPalette(definition.night, definition.day, daylight);
}
