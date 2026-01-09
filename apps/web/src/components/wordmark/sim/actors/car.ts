import { clamp01 } from "../easing";
import type { CityWordmarkLayout } from "../layout";
import { createRng } from "../rng";
import { getTimeOfDayPhase } from "../time";
import type { CityWordmarkConfig } from "../types";
import { getActorLaneY, getActorScale } from "./types";
import type { CityWordmarkActor, CityWordmarkActorContext, CityWordmarkActorRect } from "./types";

type CarState = {
  x0: number;
  speedVps: number;
  y: number;
};

function getCarCount(config: CityWordmarkConfig): number {
  if (!config.actors.cars) return 0;
  if (config.density === "sparse") return 1;
  if (config.density === "dense") return 3;
  return 2;
}

// Car dimensions in units (unit = half scale, same as birds)
// At scale=3: unit=1, car is 8x3 voxels
// Simple silhouette: roof inset, body, wheel shadows
const CAR_WIDTH_UNITS = 8;
const CAR_HEIGHT_UNITS = 3;

function createCarActor(state: CarState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: { nowMs: number; config: CityWordmarkConfig; layout: CityWordmarkLayout }): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;
    const scale = getActorScale(ctx.layout);
    const unit = Math.max(1, Math.floor(scale / 2));

    const width = CAR_WIDTH_UNITS * unit;

    const period = sceneWidth + width + 8 * unit;
    const x = Math.floor(
      ((state.x0 + (ctx.nowMs / 1000) * state.speedVps * ctx.config.timeScale) % period) - width
    );

    const margin = Math.max(2, unit * 2);
    if (x > sceneWidth + margin) return [];
    if (x + width < -margin) return [];

    const bodyTone = "car" as const;
    const out: CityWordmarkActorRect[] = [];

    // Row 0 (top): Roof - inset by 2 units on each side
    out.push({
      x: x + unit * 2,
      y: state.y,
      width: unit * 4,  // 8 - 2 - 2 = 4 units wide
      height: unit,
      tone: bodyTone,
      opacity: 0.72,
    });

    // Row 1 (middle): Full body with window indication
    out.push({
      x,
      y: state.y + unit,
      width: width,
      height: unit,
      tone: bodyTone,
      opacity: 0.88,
    });

    // Window (darker, inset)
    out.push({
      x: x + unit * 2,
      y: state.y + unit,
      width: unit * 3,
      height: unit,
      tone: bodyTone,
      opacity: 0.55,
    });

    // Row 2 (bottom): Lower body with wheel wells
    // Front section (before front wheel)
    out.push({
      x,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: bodyTone,
      opacity: 0.95,
    });

    // Middle section (between wheels)
    out.push({
      x: x + unit * 2,
      y: state.y + unit * 2,
      width: unit * 4,
      height: unit,
      tone: bodyTone,
      opacity: 0.95,
    });

    // Rear section (after rear wheel)
    out.push({
      x: x + unit * 7,
      y: state.y + unit * 2,
      width: unit,
      height: unit,
      tone: bodyTone,
      opacity: 0.95,
    });

    // Wheel shadows (darker)
    out.push(
      {
        x: x + unit,
        y: state.y + unit * 2,
        width: unit,
        height: unit,
        tone: bodyTone,
        opacity: 0.5,
      },
      {
        x: x + unit * 6,
        y: state.y + unit * 2,
        width: unit,
        height: unit,
        tone: bodyTone,
        opacity: 0.5,
      }
    );

    // Headlights and taillights at night
    const { daylight } = getTimeOfDayPhase(ctx.config.timeOfDay);
    const nightness = clamp01(1 - daylight);
    if (nightness > 0.12) {
      const lightY = state.y + unit * 2;
      // Headlight (front of car)
      out.push({
        x: x + width,
        y: lightY,
        width: unit,
        height: unit,
        tone: "headlight",
        opacity: clamp01(nightness * 0.85),
      });
      // Taillight (back of car)
      out.push({
        x: x - unit,
        y: lightY,
        width: unit,
        height: unit,
        tone: "taillight",
        opacity: clamp01(nightness * 0.7),
      });
    }

    return out;
  }

  const actor: CityWordmarkActor = {
    kind: "car",
    update: () => update(),
    render,
  };

  return actor;
}

export function spawnCarActors(ctx: CityWordmarkActorContext): CityWordmarkActor[] {
  const count = getCarCount(ctx.config);
  if (count === 0) return [];

  const rng = createRng(`${ctx.config.seed}:cars`);
  const scale = getActorScale(ctx.layout);
  const unit = Math.max(1, Math.floor(scale / 2));
  const laneY = getActorLaneY(ctx.layout, CAR_HEIGHT_UNITS);
  const width = CAR_WIDTH_UNITS * unit;

  const actors: CityWordmarkActor[] = [];
  const period = ctx.layout.sceneWidth + width + 8 * unit;
  for (let i = 0; i < count; i++) {
    const speedVps = 2.4 + rng.nextFloat() * 4.0;
    const x0 = (i / count) * period + rng.nextFloat() * 4 * unit;
    actors.push(createCarActor({ x0, speedVps, y: laneY }));
  }

  return actors;
}
