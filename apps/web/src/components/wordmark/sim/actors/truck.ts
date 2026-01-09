import { clamp01 } from "../easing";
import type { CityWordmarkLayout } from "../layout";
import { createRng } from "../rng";
import { getTimeOfDayPhase } from "../time";
import type { CityWordmarkConfig } from "../types";
import { getActorLaneY, getActorScale } from "./types";
import type { CityWordmarkActor, CityWordmarkActorContext, CityWordmarkActorRect } from "./types";

type TruckState = {
  x0: number;
  speedVps: number;
  y: number;
};

function getTruckCount(config: CityWordmarkConfig): number {
  if (!config.actors.trucks) return 0;
  if (config.density === "dense") return 2;
  if (config.density === "normal") return 1;
  return 0;
}

// Truck dimensions in units (unit = half scale, same as birds/cars)
// At scale=3: unit=1, truck is 14x3 voxels (cab + gap + trailer)
// Cab: 4 units, Gap: 1 unit, Trailer: 9 units
const TRUCK_WIDTH_UNITS = 14;
const TRUCK_HEIGHT_UNITS = 3;
const CAB_WIDTH_UNITS = 4;
const GAP_UNITS = 1;

function createTruckActor(state: TruckState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: { nowMs: number; config: CityWordmarkConfig; layout: CityWordmarkLayout }): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;
    const scale = getActorScale(ctx.layout);
    const unit = Math.max(1, Math.floor(scale / 2));

    const width = TRUCK_WIDTH_UNITS * unit;
    const cabWidth = CAB_WIDTH_UNITS * unit;
    const gap = GAP_UNITS * unit;
    const trailerWidth = width - cabWidth - gap;

    const period = sceneWidth + width + 12 * unit;
    const x = Math.floor(
      ((state.x0 + (ctx.nowMs / 1000) * state.speedVps * ctx.config.timeScale) % period) - width
    );

    const margin = Math.max(2, unit * 2);
    if (x > sceneWidth + margin) return [];
    if (x + width < -margin) return [];

    const bodyTone = "car" as const;
    const out: CityWordmarkActorRect[] = [];

    // Row 0 (top): Cab roof (inset) and Trailer top
    // Cab roof - inset by 1 unit
    out.push({
      x: x + unit,
      y: state.y,
      width: cabWidth - unit,
      height: unit,
      tone: bodyTone,
      opacity: 0.74,
    });
    // Trailer top
    out.push({
      x: x + cabWidth + gap,
      y: state.y,
      width: trailerWidth,
      height: unit,
      tone: bodyTone,
      opacity: 0.78,
    });

    // Row 1 (middle): Full cab with window, trailer body
    out.push({
      x,
      y: state.y + unit,
      width: cabWidth,
      height: unit,
      tone: bodyTone,
      opacity: 0.88,
    });
    // Cab window (darker)
    out.push({
      x: x + unit,
      y: state.y + unit,
      width: cabWidth - unit * 2,
      height: unit,
      tone: bodyTone,
      opacity: 0.55,
    });
    // Trailer middle
    out.push({
      x: x + cabWidth + gap,
      y: state.y + unit,
      width: trailerWidth,
      height: unit,
      tone: bodyTone,
      opacity: 0.84,
    });

    // Row 2 (bottom): Lower body with wheel wells
    // Cab front section
    out.push({
      x,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: bodyTone,
      opacity: 0.95,
    });
    // Cab wheel shadow
    out.push({
      x: x + unit,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: bodyTone,
      opacity: 0.5,
    });
    // Cab rear and gap
    out.push({
      x: x + unit * 2,
      y: state.y + unit * 2,
      width: cabWidth - unit * 2 + gap,
      height: unit,
      tone: bodyTone,
      opacity: 0.95,
    });
    // Trailer front wheel shadow
    out.push({
      x: x + cabWidth + gap,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: bodyTone,
      opacity: 0.5,
    });
    // Trailer middle section
    out.push({
      x: x + cabWidth + gap + unit,
      y: state.y + unit * 2,
      width: trailerWidth - unit * 2,
      height: unit,
      tone: bodyTone,
      opacity: 0.95,
    });
    // Trailer rear wheel shadow
    out.push({
      x: x + width - unit,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: bodyTone,
      opacity: 0.5,
    });

    // Headlights and taillights at night
    const { daylight } = getTimeOfDayPhase(ctx.config.timeOfDay);
    const nightness = clamp01(1 - daylight);
    if (nightness > 0.12) {
      const lightY = state.y + unit * 2;
      // Headlight (front)
      out.push({
        x: x + width,
        y: lightY,
        width: unit,
        height: unit,
        tone: "headlight",
        opacity: clamp01(nightness * 0.85),
      });
      // Taillights (back) - trucks have two stacked
      out.push({
        x: x - unit,
        y: lightY,
        width: unit,
        height: unit,
        tone: "taillight",
        opacity: clamp01(nightness * 0.7),
      });
      out.push({
        x: x - unit,
        y: lightY - unit,
        width: unit,
        height: unit,
        tone: "taillight",
        opacity: clamp01(nightness * 0.5),
      });
    }

    return out;
  }

  const actor: CityWordmarkActor = {
    kind: "truck",
    update: () => update(),
    render,
  };

  return actor;
}

export function spawnTruckActors(ctx: CityWordmarkActorContext): CityWordmarkActor[] {
  const count = getTruckCount(ctx.config);
  if (count === 0) return [];

  const rng = createRng(`${ctx.config.seed}:trucks`);
  const unit = Math.max(1, Math.floor(getActorScale(ctx.layout) / 2));
  const laneY = getActorLaneY(ctx.layout, TRUCK_HEIGHT_UNITS);
  const width = TRUCK_WIDTH_UNITS * unit;

  const actors: CityWordmarkActor[] = [];
  const period = ctx.layout.sceneWidth + width + 12 * unit;
  for (let i = 0; i < count; i++) {
    const speedVps = 2 + rng.nextFloat() * 2;
    const x0 = (i / count) * period + rng.nextFloat() * 6 * unit;
    actors.push(createTruckActor({ x0, speedVps, y: laneY }));
  }

  return actors;
}
