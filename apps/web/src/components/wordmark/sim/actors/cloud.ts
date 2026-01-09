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
  if (config.density === "dense") return 3;
  return 2;
}

function createCloudActor(state: CloudState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: CityWordmarkActorRenderContext): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;

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

    // Generate cloud puffs - small overlapping rectangles
    // Puff size is proportional to cloud height
    const puffSize = Math.max(1, Math.floor(state.height * 0.7));

    for (let i = 0; i < state.puffCount; i++) {
      const puffX = x + Math.floor(rng.nextFloat() * Math.max(1, state.width - puffSize));
      const puffY = state.y + Math.floor(rng.nextFloat() * Math.max(1, state.height - puffSize));
      const puffW = puffSize + Math.floor(rng.nextFloat() * puffSize * 0.3);
      const puffH = puffSize;

      out.push({
        x: puffX,
        y: puffY,
        width: puffW,
        height: puffH,
        tone: "cloud",
        // Narrower opacity range (0.18-0.22) for more cohesive cloud mass
        opacity: 0.18 + rng.nextFloat() * 0.04,
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
  const minY = Math.max(1, Math.floor(ctx.layout.height * 0.03));
  const maxY = Math.floor(ctx.layout.height * 0.2);

  const actors: CityWordmarkActor[] = [];
  const period = ctx.layout.sceneWidth * 2;

  for (let i = 0; i < count; i++) {
    // Cloud width: 2-4 scale units (at scale=3: 6-12 voxels)
    // Reduced from 3-6 to maintain perspective (distant clouds should be smaller)
    const width = scale * (2 + Math.floor(rng.nextFloat() * 2));
    // Cloud height: 1-2 scale units (at scale=3: 3-6 voxels)
    const height = scale * (1 + Math.floor(rng.nextFloat() * 2));
    const speedVps = 1 + rng.nextFloat() * 1.5; // Slow drift
    const x0 = (i / count) * period + rng.nextFloat() * period * 0.4;
    const y = minY + Math.floor(rng.nextFloat() * Math.max(1, maxY - minY));
    // Fewer puffs for smaller clouds
    const puffCount = 2 + Math.floor(rng.nextFloat() * 2);
    const seed = Math.floor(rng.nextFloat() * 10000);

    actors.push(createCloudActor({ x0, y, speedVps, width, height, puffCount, seed }));
  }

  return actors;
}
