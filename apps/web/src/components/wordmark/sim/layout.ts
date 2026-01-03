import { createRng } from "./rng";
import { CITY_WORDMARK_TEXT, getCityWordmarkGlyph, getCityWordmarkGlyphMetrics } from "./glyphs";
import type { CityWordmarkRenderDetail } from "./types";

export type CityWordmarkVoxelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CityWordmarkLayout = {
  width: number;
  sceneWidth: number;
  height: number;
  rects: CityWordmarkVoxelRect[];
  baselineY: number;
  glyphRows: number;
  glyphCols: number;
  topPadding: number;
  detailScale: number;
  resolution: number;
  gridScale: number;
};

export type CityWordmarkLayoutOptions = {
  text?: string;
  /** Columns of spacing between glyphs (in voxel units). */
  letterSpacing?: number;
  /** Rows of padding above the glyphs (in voxel units). */
  topPadding?: number;
  /** Resolution multiplier for expanding the glyph grid. */
  resolution?: number;
  /** Multiplier for the full scene width (banner width). */
  sceneScale?: number;
  /** Render detail preset (standard vs HD glyph grids). */
  detail?: CityWordmarkRenderDetail;
};

const DEFAULT_LAYOUT: Required<CityWordmarkLayoutOptions> = {
  text: CITY_WORDMARK_TEXT,
  letterSpacing: 1,
  topPadding: 4,
  resolution: 1,
  sceneScale: 1,
  detail: "standard",
};

export function createCityWordmarkLayout(options: CityWordmarkLayoutOptions = {}): CityWordmarkLayout {
  const text = options.text ?? DEFAULT_LAYOUT.text;
  const detail = options.detail ?? DEFAULT_LAYOUT.detail;
  const { rows: glyphRowsBase, cols: glyphColsBase, scale: detailScale } = getCityWordmarkGlyphMetrics(detail);
  const letterSpacingBase = options.letterSpacing ?? DEFAULT_LAYOUT.letterSpacing;
  const topPaddingBase = options.topPadding ?? DEFAULT_LAYOUT.topPadding;
  const resolution = Math.max(1, Math.floor(options.resolution ?? DEFAULT_LAYOUT.resolution));
  const gridScale = resolution * detailScale;
  const letterSpacing = letterSpacingBase * gridScale;
  const topPadding = topPaddingBase * gridScale;
  const glyphRows = glyphRowsBase * resolution;
  const glyphCols = glyphColsBase * resolution;
  const sceneScale = Math.max(1, Math.floor(options.sceneScale ?? DEFAULT_LAYOUT.sceneScale));

  let xCursor = 0;
  const rects: CityWordmarkVoxelRect[] = [];

  const expandGlyph = (glyph: string[]): string[] => {
    if (resolution === 1) return glyph;
    const out: string[] = [];
    for (const row of glyph) {
      const expandedRow = row
        .split("")
        .map((cell) => cell.repeat(resolution))
        .join("");
      for (let r = 0; r < resolution; r++) out.push(expandedRow);
    }
    return out;
  };

  for (const rawChar of text) {
    if (rawChar === " ") {
      xCursor += letterSpacing * 2;
      continue;
    }

    const glyph = expandGlyph([...getCityWordmarkGlyph(rawChar, detail)]);

    for (let row = 0; row < glyphRows; row++) {
      const line = glyph[row] ?? "";

      let col = 0;
      while (col < glyphCols) {
        const cell = line[col] ?? ".";
        if (cell === ".") {
          col++;
          continue;
        }

        const start = col;
        while (col < glyphCols && (line[col] ?? ".") !== ".") col++;
        const run = col - start;

        rects.push({ x: xCursor + start, y: topPadding + row, width: run, height: 1 });
      }
    }

    xCursor += glyphCols + letterSpacing;
  }

  const width = Math.max(0, xCursor - (text.length > 0 ? letterSpacing : 0));
  const sceneWidth = Math.max(width, width * sceneScale);
  const baselineY = topPadding + glyphRows;
  const height = baselineY;

  return {
    width,
    sceneWidth,
    height,
    rects,
    baselineY,
    glyphRows,
    glyphCols,
    topPadding,
    detailScale,
    resolution,
    gridScale,
  };
}

export type CityWordmarkSkylineMaskOptions = {
  width: number;
  baselineY: number;
  seed?: string;
  minHeight?: number;
  maxHeight?: number;
  minSegmentWidth?: number;
  maxSegmentWidth?: number;
};

const DEFAULT_SKYLINE: Required<Omit<CityWordmarkSkylineMaskOptions, "width" | "baselineY">> = {
  seed: "markdowntown",
  minHeight: 2,
  maxHeight: 6,
  minSegmentWidth: 2,
  maxSegmentWidth: 6,
};

export function createCityWordmarkSkylineMask(options: CityWordmarkSkylineMaskOptions): CityWordmarkVoxelRect[] {
  const seed = options.seed ?? DEFAULT_SKYLINE.seed;
  const minHeight = options.minHeight ?? DEFAULT_SKYLINE.minHeight;
  const maxHeight = options.maxHeight ?? DEFAULT_SKYLINE.maxHeight;
  const minSegmentWidth = options.minSegmentWidth ?? DEFAULT_SKYLINE.minSegmentWidth;
  const maxSegmentWidth = options.maxSegmentWidth ?? DEFAULT_SKYLINE.maxSegmentWidth;

  if (options.width <= 0) return [];
  if (options.baselineY <= 0) return [];
  if (minHeight <= 0 || maxHeight <= 0 || maxHeight < minHeight) {
    throw new Error("createCityWordmarkSkylineMask: invalid height range");
  }
  if (minSegmentWidth <= 0 || maxSegmentWidth < minSegmentWidth) {
    throw new Error("createCityWordmarkSkylineMask: invalid segment width range");
  }

  const rng = createRng(`${seed}:skyline`);
  const rects: CityWordmarkVoxelRect[] = [];

  let x = 0;
  while (x < options.width) {
    const segmentWidth = Math.min(options.width - x, rng.nextInt(minSegmentWidth, maxSegmentWidth + 1));
    const height = rng.nextInt(minHeight, maxHeight + 1);
    rects.push({ x, y: Math.max(0, options.baselineY - height), width: segmentWidth, height });
    x += segmentWidth;
  }

  return rects;
}

export function getIntegerScaleToFitHeight(targetHeightPx: number, layoutHeight: number): number {
  if (!Number.isFinite(targetHeightPx) || targetHeightPx <= 0) return 1;
  if (!Number.isFinite(layoutHeight) || layoutHeight <= 0) return 1;
  return Math.max(1, Math.floor(targetHeightPx / layoutHeight));
}
