import { describe, expect, it } from "vitest";
import {
  createCityWordmarkWindows,
  getCityWordmarkWindowLights,
} from "@/components/wordmark/sim/windowLights";

describe("windowLights", () => {
  it("creates deterministic windows for a given seed", () => {
    const a = createCityWordmarkWindows({ seed: "seed", text: "MARKDOWNTOWN", windowChance: 1 });
    const b = createCityWordmarkWindows({ seed: "seed", text: "MARKDOWNTOWN", windowChance: 1 });
    expect(a).toEqual(b);
  });

  it("turns lights off during day", () => {
    const windows = createCityWordmarkWindows({ seed: "seed", text: "MARKDOWNTOWN", windowChance: 1 });
    const lights = getCityWordmarkWindowLights(windows, { nowMs: 1234, timeOfDay: 0.5, intensity: 1 });
    expect(Array.from(lights)).toEqual(new Array(windows.length).fill(0));
  });

  it("is deterministic by seed + time-of-day + nowMs", () => {
    const windows = createCityWordmarkWindows({
      seed: "seed",
      text: "MARKDOWNTOWN",
      windowChance: 1,
      minCycleMs: 1000,
      maxCycleMs: 1000,
    });

    const at0 = getCityWordmarkWindowLights(windows, { nowMs: 0, timeOfDay: 0.9, intensity: 1 });
    const at500 = getCityWordmarkWindowLights(windows, { nowMs: 500, timeOfDay: 0.9, intensity: 1 });

    expect(Array.from(at0)).not.toEqual(Array.from(at500));
    expect(Array.from(at0)).toEqual(
      Array.from(getCityWordmarkWindowLights(windows, { nowMs: 0, timeOfDay: 0.9, intensity: 1 }))
    );
  });

  it("expands window grid when detail is hd", () => {
    const standard = createCityWordmarkWindows({
      seed: "seed",
      text: "MARKDOWNTOWN",
      windowChance: 1,
      detail: "standard",
    });
    const hd = createCityWordmarkWindows({
      seed: "seed",
      text: "MARKDOWNTOWN",
      windowChance: 1,
      detail: "hd",
    });

    expect(standard.length).toBeGreaterThan(0);
    expect(hd.length).toBeGreaterThan(0);

    const maxXStandard = Math.max(...standard.map((w) => w.x));
    const maxXHd = Math.max(...hd.map((w) => w.x));
    const maxYStandard = Math.max(...standard.map((w) => w.y));
    const maxYHd = Math.max(...hd.map((w) => w.y));

    expect(maxXHd).toBeGreaterThan(maxXStandard);
    expect(maxYHd).toBeGreaterThan(maxYStandard);
  });

  it("respects intensity", () => {
    const windows = createCityWordmarkWindows({ seed: "seed", text: "MARKDOWNTOWN", windowChance: 1 });
    const off = getCityWordmarkWindowLights(windows, { nowMs: 999, timeOfDay: 0.9, intensity: 0 });
    expect(Array.from(off)).toEqual(new Array(windows.length).fill(0));
  });
});
