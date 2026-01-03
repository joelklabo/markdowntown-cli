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
  width: number;
  y: number;
  flashPeriodMs: number;
};

function getX(state: AmbulanceState, ctx: { nowMs: number; config: CityWordmarkConfig }): number {
  const elapsedS = Math.max(0, (ctx.nowMs - state.spawnAtMs) / 1000);
  return Math.floor(state.x0 + elapsedS * state.speedVps * ctx.config.timeScale);
}

function createAmbulanceActor(state: AmbulanceState): CityWordmarkActor {
  function update(ctx: CityWordmarkActorUpdateContext): CityWordmarkActor {
    if (!ctx.config.actors.ambulance) return { ...actor, done: true };

    const x = getX(state, ctx);
    const offScreen = x > ctx.layout.sceneWidth + 3 * getActorScale(ctx.layout);
    const expired = ctx.nowMs >= state.endAtMs;
    if (expired && offScreen) return { ...actor, done: true };
    return actor;
  }

  function render(ctx: { nowMs: number; config: CityWordmarkConfig; layout: CityWordmarkLayout }): CityWordmarkActorRect[] {
    const x = getX(state, ctx);
    const margin = Math.max(2, getActorScale(ctx.layout) * 2);
    if (x > ctx.layout.sceneWidth + margin) return [];
    if (x + state.width < -margin) return [];

    const scale = getActorScale(ctx.layout);
    const isHd = scale > 1;
    const out: CityWordmarkActorRect[] = [];

    if (isHd) {
      const roofInset = scale;
      const windowInset = Math.max(1, Math.floor(scale / 2));
      const stripeHeight = Math.max(1, Math.floor(scale / 2));
      const stripeY = state.y + scale + Math.max(0, Math.floor(scale / 2));
      const wheelSize = Math.max(1, Math.floor(scale / 2));
      const wheelY = state.y + scale * 2;
      out.push(
        {
          x: x + roofInset,
          y: state.y,
          width: state.width - roofInset * 2,
          height: scale,
          tone: "ambulance",
          opacity: 0.78,
        },
        {
          x,
          y: state.y + scale,
          width: state.width,
          height: scale,
          tone: "ambulance",
          opacity: 0.9,
        },
        {
          x,
          y: state.y + scale * 2,
          width: state.width,
          height: scale,
          tone: "ambulance",
          opacity: 0.97,
        },
        {
          x: x + windowInset,
          y: state.y + scale,
          width: Math.max(1, state.width - windowInset * 2 - scale),
          height: scale,
          tone: "ambulance",
          opacity: 0.55,
        },
        {
          x: x + scale,
          y: stripeY,
          width: Math.max(1, state.width - scale * 3),
          height: stripeHeight,
          tone: "sirenRed",
          opacity: 0.45,
        },
        {
          x: x + scale,
          y: wheelY,
          width: wheelSize,
          height: wheelSize,
          tone: "ambulance",
          opacity: 0.6,
        },
        {
          x: x + state.width - scale - wheelSize,
          y: wheelY,
          width: wheelSize,
          height: wheelSize,
          tone: "ambulance",
          opacity: 0.6,
        }
      );
    } else {
      out.push(
        { x: x + 1, y: state.y, width: state.width - 2, height: 1, tone: "ambulance", opacity: 0.85 },
        { x, y: state.y + 1, width: state.width, height: 1, tone: "ambulance", opacity: 0.95 }
      );
    }

    const flashT = Math.max(0, ctx.nowMs - state.spawnAtMs);
    const phase = Math.floor(flashT / state.flashPeriodMs) % 2;
    const redOpacity = phase === 0 ? 1 : 0.22;
    const blueOpacity = phase === 1 ? 1 : 0.22;
    const sirenSize = isHd ? scale : 1;
    const sirenY = isHd ? state.y - scale : state.y - 1;

    out.push(
      { x: x + 2 * scale, y: sirenY, width: sirenSize, height: sirenSize, tone: "sirenRed", opacity: redOpacity },
      { x: x + 4 * scale, y: sirenY, width: sirenSize, height: sirenSize, tone: "sirenBlue", opacity: blueOpacity },
      {
        x: x + state.width,
        y: isHd ? state.y + scale * 2 : state.y + 1,
        width: sirenSize,
        height: sirenSize,
        tone: "headlight",
        opacity: 1,
      }
    );

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
  const scale = getActorScale(ctx.layout);
  const rowCount = scale > 1 ? 3 : 2;
  const laneY = getActorLaneY(ctx.layout, rowCount);
  const width = 7 * scale;
  const speedVps = 7 + rng.nextFloat() * 3;
  const x0 = -width - 2 * scale + rng.nextFloat() * (2 * scale);

  return createAmbulanceActor({
    spawnAtMs: ctx.nowMs,
    endAtMs: ctx.nowMs + 9_000,
    x0,
    speedVps,
    width,
    y: laneY,
    flashPeriodMs: 180,
  });
}
