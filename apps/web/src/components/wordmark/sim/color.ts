import { clamp01, lerp } from "./easing";

export type Rgb = readonly [number, number, number];

function clampByte(value: number): number {
  const rounded = Math.round(value);
  return Math.min(255, Math.max(0, rounded));
}

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const x = clamp01(t);
  return [
    clampByte(lerp(a[0], b[0], x)),
    clampByte(lerp(a[1], b[1], x)),
    clampByte(lerp(a[2], b[2], x)),
  ] as const;
}

