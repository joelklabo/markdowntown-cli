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
  width: number;
  cabWidth: number;
  y: number;
};

function getTruckCount(config: CityWordmarkConfig): number {
  if (!config.actors.trucks) return 0;
  if (config.density === "dense") return 2;
  if (config.density === "normal") return 1;
  return 0;
}

function createTruckActor(state: TruckState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: { nowMs: number; config: CityWordmarkConfig; layout: CityWordmarkLayout }): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;
    const scale = getActorScale(ctx.layout);
    const period = sceneWidth + state.width + 12 * scale;
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
      const gap = scale;
      const trailerWidth = state.width - state.cabWidth - gap;
      const windowInset = Math.max(1, Math.floor(scale / 2));
      const wheelSize = Math.max(1, Math.floor(scale / 2));
      const wheelY = state.y + scale * 2;
      out.push(
        {
          x: x + scale,
          y: state.y,
          width: state.cabWidth - scale,
          height: scale,
          tone: bodyTone,
          opacity: 0.74,
        },
        {
          x: x + state.cabWidth + gap,
          y: state.y,
          width: trailerWidth,
          height: scale,
          tone: bodyTone,
          opacity: 0.78,
        },
        {
          x,
          y: state.y + scale,
          width: state.cabWidth,
          height: scale,
          tone: bodyTone,
          opacity: 0.88,
        },
        {
          x: x + state.cabWidth + gap,
          y: state.y + scale,
          width: trailerWidth,
          height: scale,
          tone: bodyTone,
          opacity: 0.84,
        },
        {
          x,
          y: state.y + scale * 2,
          width: state.width,
          height: scale,
          tone: bodyTone,
          opacity: 0.95,
        },
        {
          x: x + windowInset,
          y: state.y + scale,
          width: Math.max(1, state.cabWidth - windowInset * 2),
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
          opacity: 0.58,
        },
        {
          x: x + state.cabWidth + gap + scale,
          y: wheelY,
          width: wheelSize,
          height: wheelSize,
          tone: bodyTone,
          opacity: 0.58,
        },
        {
          x: x + state.width - scale - wheelSize,
          y: wheelY,
          width: wheelSize,
          height: wheelSize,
          tone: bodyTone,
          opacity: 0.58,
        }
      );
    } else {
      out.push(
        {
          x: x + state.cabWidth,
          y: state.y,
          width: state.width - state.cabWidth,
          height: 1,
          tone: bodyTone,
          opacity: 0.82,
        },
        { x: x + 1, y: state.y, width: state.cabWidth - 1, height: 1, tone: bodyTone, opacity: 0.88 },
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
  const scale = getActorScale(ctx.layout);
  const rowCount = scale > 1 ? 3 : 2;
  const laneY = getActorLaneY(ctx.layout, rowCount);

  const actors: CityWordmarkActor[] = [];
  const width = 10 * scale;
  const cabWidth = 4 * scale;
  const period = ctx.layout.sceneWidth + width + 12 * scale;
  for (let i = 0; i < count; i++) {
    const speedVps = 2 + rng.nextFloat() * 2;
    const x0 = (i / count) * period + rng.nextFloat() * 6 * scale;
    actors.push(createTruckActor({ x0, speedVps, width, cabWidth, y: laneY }));
  }

  return actors;
}
