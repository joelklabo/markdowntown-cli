import type { CityWordmarkLayout } from "../layout";
import { createRng } from "../rng";
import type { CityWordmarkConfig } from "../types";
import { getActorLaneY, getActorScale } from "./types";
import type { CityWordmarkActor, CityWordmarkActorContext, CityWordmarkActorRect, CityWordmarkActorUpdateContext } from "./types";

type AmbulanceState = {
  spawnAtMs: number;
  endAtMs: number;
  x0: number;
  speedVps: number;
  y: number;
  flashPeriodMs: number;
};

// Ambulance dimensions in units (unit = half scale, same as all actors)
// At scale=3: unit=1, ambulance is 10x3 voxels (between car and truck)
// Structure: roof (inset), body, lower body with wheels, sirens on top
const AMBULANCE_WIDTH_UNITS = 10;
const AMBULANCE_HEIGHT_UNITS = 3;

function getX(state: AmbulanceState, ctx: { nowMs: number; config: CityWordmarkConfig }, unit: number): number {
  const elapsedS = Math.max(0, (ctx.nowMs - state.spawnAtMs) / 1000);
  return Math.floor(state.x0 * unit + elapsedS * state.speedVps * ctx.config.timeScale);
}

function createAmbulanceActor(state: AmbulanceState): CityWordmarkActor {
  function update(ctx: CityWordmarkActorUpdateContext): CityWordmarkActor {
    if (!ctx.config.actors.ambulance) return { ...actor, done: true };

    const unit = Math.max(1, Math.floor(getActorScale(ctx.layout) / 2));
    const x = getX(state, ctx, unit);
    const offScreen = x > ctx.layout.sceneWidth + 3 * unit;
    const expired = ctx.nowMs >= state.endAtMs;
    if (expired && offScreen) return { ...actor, done: true };
    return actor;
  }

  function render(ctx: { nowMs: number; config: CityWordmarkConfig; layout: CityWordmarkLayout }): CityWordmarkActorRect[] {
    const scale = getActorScale(ctx.layout);
    const unit = Math.max(1, Math.floor(scale / 2));
    const width = AMBULANCE_WIDTH_UNITS * unit;

    const x = getX(state, ctx, unit);
    const margin = Math.max(2, unit * 2);
    if (x > ctx.layout.sceneWidth + margin) return [];
    if (x + width < -margin) return [];

    const out: CityWordmarkActorRect[] = [];

    // Row 0 (top): Roof - inset by 2 units on each side
    out.push({
      x: x + unit * 2,
      y: state.y,
      width: unit * 6,  // 10 - 2 - 2 = 6 units wide
      height: unit,
      tone: "ambulance",
      opacity: 0.78,
    });

    // Row 1 (middle): Full body with window
    out.push({
      x,
      y: state.y + unit,
      width: width,
      height: unit,
      tone: "ambulance",
      opacity: 0.9,
    });

    // Window (darker, inset)
    out.push({
      x: x + unit * 2,
      y: state.y + unit,
      width: unit * 4,
      height: unit,
      tone: "ambulance",
      opacity: 0.55,
    });

    // Red stripe (middle of body)
    out.push({
      x: x + unit * 2,
      y: state.y + unit,
      width: unit * 5,
      height: unit,
      tone: "sirenRed",
      opacity: 0.35,
    });

    // Row 2 (bottom): Lower body with wheel wells
    // Front section
    out.push({
      x,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: "ambulance",
      opacity: 0.97,
    });

    // Front wheel shadow
    out.push({
      x: x + unit,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: "ambulance",
      opacity: 0.5,
    });

    // Middle section (between wheels)
    out.push({
      x: x + unit * 2,
      y: state.y + unit * 2,
      width: unit * 6,
      height: unit,
      tone: "ambulance",
      opacity: 0.97,
    });

    // Rear wheel shadow
    out.push({
      x: x + unit * 8,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: "ambulance",
      opacity: 0.5,
    });

    // Rear section
    out.push({
      x: x + unit * 9,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: "ambulance",
      opacity: 0.97,
    });

    // Sirens on top (above roof) - centered at 25% and 75% for visual balance
    const flashT = Math.max(0, ctx.nowMs - state.spawnAtMs);
    const phase = Math.floor(flashT / state.flashPeriodMs) % 2;
    const redOpacity = phase === 0 ? 1 : 0.22;
    const blueOpacity = phase === 1 ? 1 : 0.22;
    const sirenY = state.y - unit;
    // Positions: 2.5 units (25%) and 7.5 units (75%) from left on 10-unit body
    // Use 2 and 7 for integer positions
    out.push(
      { x: x + unit * 2, y: sirenY, width: unit, height: unit, tone: "sirenRed", opacity: redOpacity },
      { x: x + unit * 7, y: sirenY, width: unit, height: unit, tone: "sirenBlue", opacity: blueOpacity }
    );

    // Headlight
    out.push({
      x: x + width,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: "headlight",
      opacity: 1,
    });

    return out;
  }

  const actor: CityWordmarkActor = {
    kind: "ambulance",
    update,
    render,
  };

  return actor;
}

export function spawnAmbulanceActor(
  ctx: CityWordmarkActorContext & { nowMs: number; triggerIndex: number }
): CityWordmarkActor | null {
  if (!ctx.config.actors.ambulance) return null;

  const rng = createRng(`${ctx.config.seed}:ambulance:${ctx.triggerIndex}`);
  const unit = Math.max(1, Math.floor(getActorScale(ctx.layout) / 2));
  const laneY = getActorLaneY(ctx.layout, AMBULANCE_HEIGHT_UNITS);
  const width = AMBULANCE_WIDTH_UNITS * unit;
  const speedVps = 7 + rng.nextFloat() * 3;
  // x0 is in unit-less form, will be multiplied by unit in getX
  const x0 = (-width / unit - 2 + rng.nextFloat() * 2);

  return createAmbulanceActor({
    spawnAtMs: ctx.nowMs,
    endAtMs: ctx.nowMs + 9_000,
    x0,
    speedVps,
    y: laneY,
    flashPeriodMs: 180,
  });
}
