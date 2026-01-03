import type { CityWordmarkLayout } from "../layout";
import { createRng } from "../rng";
import type { CityWordmarkConfig } from "../types";
import { getActorScale } from "./types";
import type { CityWordmarkActor, CityWordmarkActorContext, CityWordmarkActorRect } from "./types";

type Pedestrian = {
  minX: number;
  maxX: number;
  speedVps: number;
  phase: number;
  yBody: number;
  hasDog: boolean;
  dogOffset: number;
};

type PedestrianState = {
  pedestrians: readonly Pedestrian[];
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getPedestrianCount(config: CityWordmarkConfig): number {
  if (!config.actors.pedestrians) return 0;
  if (config.density === "sparse") return 1;
  if (config.density === "dense") return 5;
  return 3;
}

function pingPong(t: number, length: number): number {
  if (length <= 0) return 0;
  const period = length * 2;
  const wrapped = ((t % period) + period) % period;
  return wrapped <= length ? wrapped : period - wrapped;
}

function createPedestrianActor(state: PedestrianState): CityWordmarkActor {
  function update() {
    return actor;
  }

  function render(ctx: { nowMs: number; config: CityWordmarkConfig; layout: CityWordmarkLayout }): CityWordmarkActorRect[] {
    if (!ctx.config.actors.pedestrians) return [];
    if (state.pedestrians.length === 0) return [];

    const out: CityWordmarkActorRect[] = [];
    const scale = getActorScale(ctx.layout);
    const isHd = scale > 1;
    const bodyWidth = isHd ? scale : 1;
    const bodyHeight = isHd ? scale * 2 : 1;
    const headSize = isHd ? scale : 1;
    const limbSize = isHd ? Math.max(1, Math.floor(scale / 2)) : 1;

    for (const p of state.pedestrians) {
      const segmentLen = Math.max(0, p.maxX - p.minX);
      const travel = (ctx.nowMs / 1000) * p.speedVps * ctx.config.timeScale + p.phase;
      const dx = pingPong(travel, segmentLen);
      const x = p.minX + Math.floor(dx);

      if (x + bodyWidth <= 0 || x >= ctx.layout.sceneWidth) continue;
      if (p.yBody < 0 || p.yBody + bodyHeight > ctx.layout.height) continue;

      const yHead = p.yBody - headSize;

      if (yHead >= 0) {
        out.push({ x, y: yHead, width: headSize, height: headSize, tone: "pedestrian", opacity: 0.55 });
      }

      if (isHd) {
        out.push(
          { x, y: p.yBody, width: bodyWidth, height: scale, tone: "pedestrian", opacity: 0.85 },
          {
            x: x + Math.max(0, Math.floor(scale / 2)),
            y: p.yBody + scale,
            width: bodyWidth,
            height: scale,
            tone: "pedestrian",
            opacity: 0.85,
          },
          {
            x: x + Math.max(0, Math.floor(scale / 3)),
            y: p.yBody + scale * 2 - limbSize,
            width: limbSize,
            height: limbSize,
            tone: "pedestrian",
            opacity: 0.6,
          }
        );

        const armX = x + bodyWidth;
        if (armX + limbSize <= ctx.layout.sceneWidth) {
          out.push({
            x: armX,
            y: p.yBody + Math.max(0, Math.floor(scale / 2)),
            width: limbSize,
            height: limbSize,
            tone: "pedestrian",
            opacity: 0.6,
          });
        }
      } else {
        out.push({ x, y: p.yBody, width: 1, height: 1, tone: "pedestrian", opacity: 0.85 });
      }

      if (p.hasDog) {
        const dogX = x + p.dogOffset * scale;
        const dogY = p.yBody + (isHd ? scale : 0);
        if (dogX >= 0 && dogX < ctx.layout.sceneWidth) {
          if (isHd) {
            const dogBodyWidth = scale * 2;
            const dogHeadX = dogX + dogBodyWidth;
            if (dogHeadX + scale <= ctx.layout.sceneWidth) {
              out.push(
                { x: dogX, y: dogY, width: dogBodyWidth, height: scale, tone: "dog", opacity: 0.72 },
                { x: dogHeadX, y: dogY, width: scale, height: scale, tone: "dog", opacity: 0.62 }
              );

              const tailSize = Math.max(1, Math.floor(scale / 2));
              const tailX = dogX - tailSize;
              if (tailX >= 0) {
                out.push({
                  x: tailX,
                  y: dogY + Math.max(0, Math.floor(scale / 2)),
                  width: tailSize,
                  height: tailSize,
                  tone: "dog",
                  opacity: 0.52,
                });
              }
            }
          } else {
            out.push({ x: dogX, y: p.yBody, width: 1, height: 1, tone: "dog", opacity: 0.72 });
          }
        }
      }
    }

    return out;
  }

  const actor: CityWordmarkActor = {
    kind: "pedestrians",
    update: () => update(),
    render,
  };

  return actor;
}

export function spawnPedestrianActors(ctx: CityWordmarkActorContext): CityWordmarkActor[] {
  const count = getPedestrianCount(ctx.config);
  if (count === 0) return [];
  if (ctx.layout.sceneWidth <= 0 || ctx.layout.height <= 0) return [];

  const rng = createRng(`${ctx.config.seed}:pedestrians`);
  const xMax = Math.max(0, ctx.layout.sceneWidth - 1);
  if (xMax < 4) return [];

  const scale = getActorScale(ctx.layout);
  const bodyHeight = scale > 1 ? scale * 2 : 1;
  const headSize = scale > 1 ? scale : 1;
  const yBody = Math.max(headSize, ctx.layout.baselineY - bodyHeight);
  if (yBody + bodyHeight > ctx.layout.height) return [];

  const desiredMinLen = 6 * scale;
  const desiredMaxLen = 14 * scale;
  const maxLen = Math.max(4, Math.min(desiredMaxLen, Math.max(4, xMax - 1)));
  const minLen = Math.min(desiredMinLen, maxLen);

  const pedestrians: Pedestrian[] = [];
  let dogCount = 0;
  for (let i = 0; i < count; i++) {
    const xBase = Math.round(((i + 1) / (count + 1)) * xMax);
    const jitter = rng.nextInt(-2 * scale, 3 * scale + 1);
    const centerX = clampInt(xBase + jitter, 1, Math.max(1, xMax - 1));

    const length = rng.nextInt(minLen, maxLen + 1);
    const minXLimit = 0;
    const maxMinX = Math.max(minXLimit, xMax - (length - 1));
    const minX = clampInt(centerX - Math.floor(length / 2), minXLimit, maxMinX);
    const maxX = Math.min(xMax, minX + length - 1);

    const speedVps = 0.9 + rng.nextFloat() * 1.6;
    const phase = rng.nextFloat() * Math.max(1, (maxX - minX) * 2);
    const dogOffset = rng.nextFloat() < 0.3 ? 1 : -1;
    const hasDog = ctx.config.actors.dogs ? rng.nextFloat() < 0.35 : false;
    if (hasDog) dogCount++;

    pedestrians.push({
      minX,
      maxX,
      speedVps,
      phase,
      yBody,
      hasDog,
      dogOffset,
    });
  }

  if (ctx.config.actors.dogs && dogCount === 0 && pedestrians.length > 0) {
    pedestrians[0] = { ...pedestrians[0], hasDog: true };
  }

  return [createPedestrianActor({ pedestrians })];
}
