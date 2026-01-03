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
  width: number;
  y: number;
};

function getCarCount(config: CityWordmarkConfig): number {
  if (!config.actors.cars) return 0;
  if (config.density === "sparse") return 1;
  if (config.density === "dense") return 3;
  return 2;
}

function createCarActor(state: CarState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: { nowMs: number; config: CityWordmarkConfig; layout: CityWordmarkLayout }): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;
    const scale = getActorScale(ctx.layout);
    const period = sceneWidth + state.width + 8 * scale;
    const x = Math.floor(
      ((state.x0 + (ctx.nowMs / 1000) * state.speedVps * ctx.config.timeScale) % period) - state.width
    );

    const margin = Math.max(2, scale * 2);
    if (x > sceneWidth + margin) return [];
    if (x + state.width < -margin) return [];

    const bodyTone = "car" as const;
    const isHd = scale > 1;
    const out: CityWordmarkActorRect[] = [];

    if (isHd) {
      const roofInset = scale;
      const windowInset = Math.max(1, Math.floor(scale / 2));
      const wheelSize = Math.max(1, Math.floor(scale / 2));
      const wheelY = state.y + scale * 2;
      out.push(
        {
          x: x + roofInset,
          y: state.y,
          width: state.width - roofInset * 2,
          height: scale,
          tone: bodyTone,
          opacity: 0.72,
        },
        {
          x,
          y: state.y + scale,
          width: state.width,
          height: scale,
          tone: bodyTone,
          opacity: 0.88,
        },
        {
          x: x + scale,
          y: state.y + scale * 2,
          width: state.width - scale,
          height: scale,
          tone: bodyTone,
          opacity: 0.95,
        },
        {
          x: x + windowInset,
          y: state.y + scale,
          width: Math.max(1, state.width - windowInset * 2 - scale),
          height: scale,
          tone: bodyTone,
          opacity: 0.55,
        },
        {
          x: x + scale,
          y: wheelY,
          width: wheelSize,
          height: wheelSize,
          tone: bodyTone,
          opacity: 0.6,
        },
        {
          x: x + state.width - scale - wheelSize,
          y: wheelY,
          width: wheelSize,
          height: wheelSize,
          tone: bodyTone,
          opacity: 0.6,
        }
      );
    } else {
      out.push(
        { x: x + 1, y: state.y, width: state.width - 2, height: 1, tone: bodyTone, opacity: 0.85 },
        { x, y: state.y + 1, width: state.width, height: 1, tone: bodyTone, opacity: 0.95 }
      );
    }

    const { daylight } = getTimeOfDayPhase(ctx.config.timeOfDay);
    const nightness = clamp01(1 - daylight);
    if (nightness > 0.12) {
      const headlightY = isHd ? state.y + scale * 2 : state.y + 1;
      const headlightSize = isHd ? scale : 1;
      out.push({
        x: x + state.width,
        y: headlightY,
        width: headlightSize,
        height: headlightSize,
        tone: "headlight",
        opacity: clamp01(nightness * 0.85),
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
  const rowCount = scale > 1 ? 3 : 2;
  const laneY = getActorLaneY(ctx.layout, rowCount);
  const width = 5 * scale;

  const actors: CityWordmarkActor[] = [];
  const period = ctx.layout.sceneWidth + width + 8 * scale;
  for (let i = 0; i < count; i++) {
    const speedVps = 2.4 + rng.nextFloat() * 4.0;
    const x0 = (i / count) * period + rng.nextFloat() * 4 * scale;
    actors.push(createCarActor({ x0, speedVps, width, y: laneY }));
  }

  return actors;
}
