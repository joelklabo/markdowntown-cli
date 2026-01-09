import { createRng } from "../rng";
import type { CityWordmarkConfig } from "../types";
import { getActorScale } from "./types";
import type {
  CityWordmarkActor,
  CityWordmarkActorContext,
  CityWordmarkActorRect,
  CityWordmarkActorRenderContext,
} from "./types";

type BirdState = {
  x0: number;
  speedVps: number;
  y: number;
  wingPhaseOffset: number;
  direction: 1 | -1;
};

function getBirdCount(config: CityWordmarkConfig): number {
  if (!config.actors.birds) return 0;
  if (config.density === "sparse") return 2;
  if (config.density === "dense") return 6;
  return 4;
}

// Simple bird silhouette - small V shape for distant birds
// Each frame is [dx, dy, w, h] relative to bird position
// At scale=3: half=1, total width = 3 voxels (appropriately small for distant sky objects)
type BirdFrame = Array<[number, number, number, number]>;

function getBirdFrames(scale: number): BirdFrame[] {
  // Use half-scale for tiny bird parts, minimum 1
  const half = Math.max(1, Math.floor(scale / 2));

  // Frame 0: Wings up (V shape pointing down)
  const wingsUp: BirdFrame = [
    // Body center dot
    [half, half, half, half],
    // Left wing tip (up-left)
    [0, 0, half, half],
    // Right wing tip (up-right)
    [half * 2, 0, half, half],
  ];

  // Frame 1: Wings level (flat line)
  const wingsLevel: BirdFrame = [
    // Body center
    [half, half, half, half],
    // Left wing
    [0, half, half, half],
    // Right wing
    [half * 2, half, half, half],
  ];

  // Frame 2: Wings down (V shape pointing up)
  const wingsDown: BirdFrame = [
    // Body center
    [half, half, half, half],
    // Left wing tip (down-left)
    [0, half * 2, half, half],
    // Right wing tip (down-right)
    [half * 2, half * 2, half, half],
  ];

  return [wingsUp, wingsLevel, wingsDown, wingsLevel];
}

function createBirdActor(state: BirdState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: CityWordmarkActorRenderContext): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;
    const scale = getActorScale(ctx.layout);

    const frames = getBirdFrames(scale);
    // Bird total width: 3 half-units = 1.5*scale
    const half = Math.max(1, Math.floor(scale / 2));
    const totalWidth = half * 3;

    const period = sceneWidth + totalWidth * 2;
    const rawX =
      (state.x0 + (ctx.nowMs / 1000) * state.speedVps * ctx.config.timeScale) %
      period;

    const x = Math.floor(
      state.direction === 1 ? rawX - totalWidth : sceneWidth - rawX
    );

    // Off-screen culling
    const margin = totalWidth;
    if (x > sceneWidth + margin) return [];
    if (x < -margin) return [];

    // Wing animation - 4 flaps per second
    const frameIndex =
      Math.floor((ctx.nowMs / 1000) * 4 + state.wingPhaseOffset) % frames.length;
    const frame = frames[frameIndex];

    const out: CityWordmarkActorRect[] = [];

    for (const [dx, dy, w, h] of frame) {
      // Flip horizontally if flying left
      const finalDx = state.direction === 1 ? dx : totalWidth - dx - w;

      out.push({
        x: x + finalDx,
        y: state.y + dy,
        width: w,
        height: h,
        tone: "bird",
        // Lower opacity (0.55) for distant sky objects - less heavy than 0.7
        opacity: 0.55,
      });
    }

    return out;
  }

  const actor: CityWordmarkActor = {
    kind: "bird",
    update: () => update(),
    render,
  };

  return actor;
}

export function spawnBirdActors(ctx: CityWordmarkActorContext): CityWordmarkActor[] {
  const count = getBirdCount(ctx.config);
  if (count === 0) return [];

  const rng = createRng(`${ctx.config.seed}:birds`);

  // Birds fly in the sky area (top portion of the scene)
  const minY = Math.max(1, Math.floor(ctx.layout.height * 0.05));
  const maxY = Math.floor(ctx.layout.height * 0.35);

  const actors: CityWordmarkActor[] = [];
  const period = ctx.layout.sceneWidth * 1.5;

  for (let i = 0; i < count; i++) {
    // Slower speed (3-5 vps) to maintain illusion of distance in sky
    const speedVps = 3 + rng.nextFloat() * 2;
    const x0 = (i / count) * period + rng.nextFloat() * period * 0.3;
    const wingPhaseOffset = rng.nextFloat() * 4;
    const y = minY + Math.floor(rng.nextFloat() * Math.max(1, maxY - minY));
    const direction = rng.nextFloat() > 0.5 ? 1 : -1;

    actors.push(createBirdActor({ x0, speedVps, y, wingPhaseOffset, direction }));
  }

  return actors;
}
