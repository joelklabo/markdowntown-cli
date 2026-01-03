import { describe, expect, it } from "vitest";
import {
  CITY_WORDMARK_PHASES,
  getCelestialPositions,
  getMoonPosition,
  getSunPosition,
  getTimeOfDayPhase,
  hoursToTimeOfDay,
  normalizeTimeOfDay,
  timeOfDayToHours,
} from "@/components/wordmark/sim/time";

describe("normalizeTimeOfDay", () => {
  it("wraps values into [0, 1)", () => {
    expect(normalizeTimeOfDay(1)).toBe(0);
    expect(normalizeTimeOfDay(-0.25)).toBeCloseTo(0.75, 10);
    expect(normalizeTimeOfDay(2.5)).toBe(0.5);
  });
});

describe("timeOfDayToHours/hoursToTimeOfDay", () => {
  it("converts between normalized time and 24h time", () => {
    expect(timeOfDayToHours(0)).toBe(0);
    expect(timeOfDayToHours(0.5)).toBe(12);
    expect(hoursToTimeOfDay(24)).toBe(0);
    expect(hoursToTimeOfDay(6)).toBe(0.25);
  });
});

describe("getTimeOfDayPhase", () => {
  it("maps representative values to phases", () => {
    expect(getTimeOfDayPhase(0).phase).toBe("night");
    expect(getTimeOfDayPhase(CITY_WORDMARK_PHASES.dawnStart + 0.01).phase).toBe("dawn");
    expect(getTimeOfDayPhase(CITY_WORDMARK_PHASES.dawnEnd + 0.05).phase).toBe("day");
    expect(getTimeOfDayPhase(CITY_WORDMARK_PHASES.duskStart + 0.02).phase).toBe("dusk");
    expect(getTimeOfDayPhase(CITY_WORDMARK_PHASES.duskEnd + 0.1).phase).toBe("night");
  });

  it("provides a daylight scalar suitable for blending", () => {
    expect(getTimeOfDayPhase(0).daylight).toBe(0);
    expect(getTimeOfDayPhase(0.5).daylight).toBe(1);
    expect(getTimeOfDayPhase(0.25).daylight).toBeGreaterThan(0);
    expect(getTimeOfDayPhase(0.75).daylight).toBeLessThan(1);
  });
});

describe("getCelestialPositions", () => {
  it("places the sun on an arc with expected anchor points", () => {
    const sunrise = getSunPosition(0.25);
    expect(sunrise.visible).toBe(false);
    expect(sunrise.x).toBeCloseTo(0, 6);
    expect(sunrise.altitude).toBeCloseTo(0, 6);

    const noon = getSunPosition(0.5);
    expect(noon.visible).toBe(true);
    expect(noon.x).toBeCloseTo(0.5, 6);
    expect(noon.altitude).toBeCloseTo(1, 6);

    const sunset = getSunPosition(0.75);
    expect(sunset.visible).toBe(false);
    expect(sunset.x).toBeCloseTo(1, 6);
    expect(sunset.altitude).toBeCloseTo(0, 6);
  });

  it("places the moon opposite the sun", () => {
    const midnight = getMoonPosition(0);
    expect(midnight.visible).toBe(true);
    expect(midnight.x).toBeCloseTo(0.5, 6);
    expect(midnight.altitude).toBeCloseTo(1, 6);
  });

  it("provides both bodies together", () => {
    const { sun, moon } = getCelestialPositions(0.5);
    expect(sun).toEqual(getSunPosition(0.5));
    expect(moon).toEqual(getMoonPosition(0.5));
  });
});
