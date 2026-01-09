import { createRng } from "../rng";
import type { CityWordmarkConfig } from "../types";
import { getActorScale } from "./types";
import type {
  CityWordmarkActor,
  CityWordmarkActorContext,
  CityWordmarkActorRect,
  CityWordmarkActorRenderContext,
} from "./types";

type CloudState = {
  x0: number;
  y: number;
  speedVps: number;
  width: number;
  height: number;
  puffCount: number;
  seed: number;
};

function getCloudCount(config: CityWordmarkConfig): number {
  if (!config.actors.clouds) return 0;
  if (config.density === "sparse") return 1;
  if (config.density === "dense") return 4;
  return 2;
}

function createCloudActor(state: CloudState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: CityWordmarkActorRenderContext): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;
    const scale = getActorScale(ctx.layout);

    const period = sceneWidth + state.width * 2;
    const rawX =
      (state.x0 + (ctx.nowMs / 1000) * state.speedVps * ctx.config.timeScale) %
      period;
    const x = Math.floor(rawX - state.width);

    // Off-screen culling
    const margin = state.width;
    if (x > sceneWidth + margin) return [];
    if (x + state.width < -margin) return [];

    const out: CityWordmarkActorRect[] = [];
    const rng = createRng(`cloud:${state.seed}`);

    // Generate cloud puffs - overlapping circles/rectangles
    const puffSize = Math.max(scale, Math.floor(state.height * 0.6));

    for (let i = 0; i < state.puffCount; i++) {
      const puffX = x + Math.floor(rng.nextFloat() * (state.width - puffSize));
      const puffY = state.y + Math.floor(rng.nextFloat() * (state.height - puffSize * 0.5));
      const puffW = puffSize + Math.floor(rng.nextFloat() * puffSize * 0.5);
      const puffH = puffSize;

      out.push({
        x: puffX,
        y: puffY,
        width: puffW,
        height: puffH,
        tone: "cloud",
        opacity: 0.12 + rng.nextFloat() * 0.08,
      });
    }

    return out;
  }

  const actor: CityWordmarkActor = {
    kind: "cloud",
    update: () => update(),
    render,
  };

  return actor;
}

export function spawnCloudActors(ctx: CityWordmarkActorContext): CityWordmarkActor[] {
  const count = getCloudCount(ctx.config);
  if (count === 0) return [];

  const rng = createRng(`${ctx.config.seed}:clouds`);
  const scale = getActorScale(ctx.layout);

  // Clouds drift in the upper portion of the sky
  const minY = Math.floor(ctx.layout.height * 0.02);
  const maxY = Math.floor(ctx.layout.height * 0.25);

  const actors: CityWordmarkActor[] = [];
  const period = ctx.layout.sceneWidth * 2;

  for (let i = 0; i < count; i++) {
    const width = scale * (8 + Math.floor(rng.nextFloat() * 8));
    const height = scale * (3 + Math.floor(rng.nextFloat() * 3));
    const speedVps = 1.5 + rng.nextFloat() * 2; // Slow drift
    const x0 = (i / count) * period + rng.nextFloat() * period * 0.4;
    const y = minY + Math.floor(rng.nextFloat() * (maxY - minY));
    const puffCount = 4 + Math.floor(rng.nextFloat() * 4);
    const seed = Math.floor(rng.nextFloat() * 10000);

    actors.push(createCloudActor({ x0, y, speedVps, width, height, puffCount, seed }));
  }

  return actors;
}
