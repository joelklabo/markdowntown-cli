import type { CityWordmarkTimeOfDay } from "./types";
import { clamp01, easeInOutSine, invLerp } from "./easing";

export type CityWordmarkDayPhase = "night" | "dawn" | "day" | "dusk";

export type CityWordmarkPhaseInfo = {
  phase: CityWordmarkDayPhase;
  /** 0..1 progress within the current phase. */
  t: number;
  /** 0..1 scalar for how \"day\" the scene should be. */
  daylight: number;
};

export type CityWordmarkCelestialPosition = {
  /** Normalized horizontal position (0..1). */
  x: number;
  /** Altitude (-1..1). Positive values are above the horizon. */
  altitude: number;
  /** True when the body is above the horizon. */
  visible: boolean;
};

export type CityWordmarkCelestialPositions = {
  sun: CityWordmarkCelestialPosition;
  moon: CityWordmarkCelestialPosition;
};

export const CITY_WORDMARK_PHASES = {
  dawnStart: 0.2,
  dawnEnd: 0.3,
  duskStart: 0.7,
  duskEnd: 0.8,
} as const;

const SUNRISE = 0.25;

export function normalizeTimeOfDay(value: number): CityWordmarkTimeOfDay {
  if (!Number.isFinite(value)) return 0;
  const wrapped = ((value % 1) + 1) % 1;
  return wrapped;
}

export function timeOfDayToHours(timeOfDay: CityWordmarkTimeOfDay): number {
  return normalizeTimeOfDay(timeOfDay) * 24;
}

export function hoursToTimeOfDay(hours: number): CityWordmarkTimeOfDay {
  if (!Number.isFinite(hours)) return 0;
  return normalizeTimeOfDay(hours / 24);
}

export function getTimeOfDayPhase(timeOfDay: CityWordmarkTimeOfDay): CityWordmarkPhaseInfo {
  const t = normalizeTimeOfDay(timeOfDay);
  const { dawnStart, dawnEnd, duskStart, duskEnd } = CITY_WORDMARK_PHASES;

  if (t >= dawnEnd && t < duskStart) {
    return { phase: "day", t: clamp01(invLerp(dawnEnd, duskStart, t)), daylight: 1 };
  }

  if (t >= duskStart && t < duskEnd) {
    const phaseT = clamp01(invLerp(duskStart, duskEnd, t));
    return { phase: "dusk", t: phaseT, daylight: 1 - easeInOutSine(phaseT) };
  }

  if (t >= dawnStart && t < dawnEnd) {
    const phaseT = clamp01(invLerp(dawnStart, dawnEnd, t));
    return { phase: "dawn", t: phaseT, daylight: easeInOutSine(phaseT) };
  }

  const phaseT = t >= duskEnd ? clamp01(invLerp(duskEnd, 1, t)) : clamp01(invLerp(0, dawnStart, t));
  return { phase: "night", t: phaseT, daylight: 0 };
}

function getBodyPosition(timeOfDay: CityWordmarkTimeOfDay): CityWordmarkCelestialPosition {
  const t = normalizeTimeOfDay(timeOfDay);
  const angle = (t - SUNRISE) * Math.PI * 2;
  const altitude = Math.sin(angle);
  const x = (1 - Math.cos(angle)) / 2;
  return { x, altitude, visible: altitude > 1e-6 };
}

export function getSunPosition(timeOfDay: CityWordmarkTimeOfDay): CityWordmarkCelestialPosition {
  return getBodyPosition(timeOfDay);
}

export function getMoonPosition(timeOfDay: CityWordmarkTimeOfDay): CityWordmarkCelestialPosition {
  return getBodyPosition(timeOfDay + 0.5);
}

export function getCelestialPositions(timeOfDay: CityWordmarkTimeOfDay): CityWordmarkCelestialPositions {
  return { sun: getSunPosition(timeOfDay), moon: getMoonPosition(timeOfDay) };
}
