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
  size: number; // Base size multiplier
};

function getBirdCount(config: CityWordmarkConfig): number {
  if (!config.actors.birds) return 0;
  if (config.density === "sparse") return 3;
  if (config.density === "dense") return 8;
  return 5;
}

// Bird silhouette frames - each frame is an array of [dx, dy, w, h] relative to bird center
// Using pixel art style with proper wing animation
type BirdFrame = Array<[number, number, number, number]>;

function getBirdFrames(scale: number): BirdFrame[] {
  const s = scale; // shorthand

  // Frame 0: Wings up
  const wingsUp: BirdFrame = [
    // Body (horizontal oval)
    [0, 0, s * 3, s],
    // Head
    [s * 3, 0, s, s],
    // Tail
    [-s, 0, s, s],
    // Left wing (up)
    [0, -s * 2, s, s * 2],
    [s, -s * 2, s, s],
    // Right wing (up)
    [s * 2, -s * 2, s, s * 2],
    [s, -s * 2, s, s],
  ];

  // Frame 1: Wings middle
  const wingsMid: BirdFrame = [
    // Body
    [0, 0, s * 3, s],
    // Head
    [s * 3, 0, s, s],
    // Tail
    [-s, 0, s, s],
    // Left wing (horizontal)
    [-s, 0, s * 2, s],
    // Right wing (horizontal)
    [s * 2, 0, s * 2, s],
  ];

  // Frame 2: Wings down
  const wingsDown: BirdFrame = [
    // Body
    [0, 0, s * 3, s],
    // Head
    [s * 3, 0, s, s],
    // Tail
    [-s, 0, s, s],
    // Left wing (down)
    [0, s, s, s * 2],
    [s, s, s, s],
    // Right wing (down)
    [s * 2, s, s, s * 2],
    [s, s, s, s],
  ];

  return [wingsUp, wingsMid, wingsDown, wingsMid]; // Loop back through mid
}

function createBirdActor(state: BirdState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: CityWordmarkActorRenderContext): CityWordmarkActorRect[] {
    const sceneWidth = ctx.layout.sceneWidth;
    const scale = getActorScale(ctx.layout);
    const birdScale = Math.max(1, Math.floor(scale * state.size));

    const frames = getBirdFrames(birdScale);
    const totalWidth = birdScale * 6; // Approximate bird width

    const period = sceneWidth + totalWidth * 2;
    const rawX =
      (state.x0 + (ctx.nowMs / 1000) * state.speedVps * ctx.config.timeScale) %
      period;

    const x = Math.floor(
      state.direction === 1
        ? rawX - totalWidth
        : sceneWidth - rawX
    );

    // Off-screen culling
    const margin = totalWidth;
    if (x > sceneWidth + margin) return [];
    if (x < -margin) return [];

    // Wing animation - 6 flaps per second
    const frameIndex = Math.floor((ctx.nowMs / 1000) * 6 + state.wingPhaseOffset) % frames.length;
    const frame = frames[frameIndex];

    const out: CityWordmarkActorRect[] = [];

    for (const [dx, dy, w, h] of frame) {
      // Flip horizontally if flying left
      const finalDx = state.direction === 1 ? dx : -dx - w + totalWidth / 2;

      out.push({
        x: x + finalDx,
        y: state.y + dy,
        width: w,
        height: h,
        tone: "bird",
        opacity: 1.0,
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
  const scale = getActorScale(ctx.layout);

  // Birds fly in the sky area (top 40% of the scene)
  const minY = Math.max(scale * 2, Math.floor(ctx.layout.height * 0.05));
  const maxY = Math.floor(ctx.layout.height * 0.4);

  const actors: CityWordmarkActor[] = [];
  const period = ctx.layout.sceneWidth * 1.5;

  for (let i = 0; i < count; i++) {
    const speedVps = 8 + rng.nextFloat() * 6; // Slower for visibility
    const x0 = (i / count) * period + rng.nextFloat() * period * 0.3;
    const wingPhaseOffset = rng.nextFloat() * 4;
    const y = minY + Math.floor(rng.nextFloat() * (maxY - minY));
    const direction = rng.nextFloat() > 0.5 ? 1 : -1;
    const size = 1.2 + rng.nextFloat() * 0.6; // Larger birds for visibility

    actors.push(createBirdActor({ x0, speedVps, y, wingPhaseOffset, direction, size }));
  }

  return actors;
}
