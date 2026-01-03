import type { Rgb } from "./color";
import type { CityWordmarkVoxelRect } from "./layout";

export function rgbToCss(rgb: Rgb): string {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

export function normalizeVoxelScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.max(1, Math.floor(scale));
}

function appendRectPath(d: string[], rect: CityWordmarkVoxelRect, scale: number): void {
  const x = rect.x * scale;
  const y = rect.y * scale;
  const w = rect.width * scale;
  const h = rect.height * scale;
  if (w <= 0 || h <= 0) return;
  d.push(`M${x} ${y}h${w}v${h}h-${w}Z`);
}

export function voxelRectsToPath(rects: readonly CityWordmarkVoxelRect[], scale: number = 1): string {
  if (!rects || rects.length === 0) return "";
  const s = normalizeVoxelScale(scale);
  const d: string[] = [];
  for (const rect of rects) appendRectPath(d, rect, s);
  return d.join("");
}

export type VoxelRectsPathBatch<M> = {
  key: string;
  meta: M;
  d: string;
};

export function batchVoxelRectsToPaths<T extends CityWordmarkVoxelRect, M>(
  rects: readonly T[],
  options: {
    scale?: number;
    getGroup: (rect: T) => { key: string; meta: M } | null;
  }
): VoxelRectsPathBatch<M>[] {
  if (!rects || rects.length === 0) return [];

  const s = normalizeVoxelScale(options.scale ?? 1);
  const batches = new Map<string, { meta: M; d: string[] }>();

  for (const rect of rects) {
    const group = options.getGroup(rect);
    if (!group) continue;
    let batch = batches.get(group.key);
    if (!batch) {
      batch = { meta: group.meta, d: [] };
      batches.set(group.key, batch);
    }
    appendRectPath(batch.d, rect, s);
  }

  const out: VoxelRectsPathBatch<M>[] = [];
  for (const [key, batch] of batches) {
    const d = batch.d.join("");
    if (!d) continue;
    out.push({ key, meta: batch.meta, d });
  }
  return out;
}
