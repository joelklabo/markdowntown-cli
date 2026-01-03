import type { CityWordmarkRenderDetail } from "./types";

type GlyphRow = string;

export type CityWordmarkGlyph = readonly GlyphRow[];

export const CITY_WORDMARK_TEXT = "MARKDOWNTOWN" as const;

export const CITY_WORDMARK_GLYPHS = {
  M: ["B...B", "BB.BB", "B.B.B", "B...B", "B...B", "B...B", "B...B"],
  A: [".BBB.", "B...B", "B...B", "BBBBB", "B...B", "B...B", "B...B"],
  R: ["BBBB.", "B...B", "B...B", "BBBB.", "B.B..", "B..B.", "B...B"],
  K: ["B...B", "B..B.", "B.B..", "BB...", "B.B..", "B..B.", "B...B"],
  D: ["BBBB.", "B...B", "B...B", "B...B", "B...B", "B...B", "BBBB."],
  O: [".BBB.", "B...B", "B...B", "B...B", "B...B", "B...B", ".BBB."],
  W: ["B...B", "B...B", "B...B", "B.B.B", "B.B.B", "BB.BB", "B...B"],
  N: ["B...B", "BB..B", "B.B.B", "B..BB", "B...B", "B...B", "B...B"],
  T: ["BBBBB", "..B..", "..B..", "..B..", "..B..", "..B..", "..B.."],
} as const satisfies Record<string, CityWordmarkGlyph>;

export const CITY_WORDMARK_GLYPH_ROWS = 7;
export const CITY_WORDMARK_GLYPH_COLS = 5;

const HD_SCALE = 3;

function isGlyphCell(glyph: CityWordmarkGlyph, row: number, col: number): boolean {
  return glyph[row]?.[col] === "B";
}

function buildHdGlyph(glyph: CityWordmarkGlyph, scale: number = HD_SCALE): CityWordmarkGlyph {
  const rows = glyph.length;
  const cols = glyph[0]?.length ?? 0;
  const out = Array.from({ length: rows * scale }, () => Array(cols * scale).fill("."));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isGlyphCell(glyph, r, c)) continue;
      const north = r > 0 && isGlyphCell(glyph, r - 1, c);
      const south = r < rows - 1 && isGlyphCell(glyph, r + 1, c);
      const west = c > 0 && isGlyphCell(glyph, r, c - 1);
      const east = c < cols - 1 && isGlyphCell(glyph, r, c + 1);

      const baseRow = r * scale;
      const baseCol = c * scale;

      for (let dr = 0; dr < scale; dr++) {
        for (let dc = 0; dc < scale; dc++) {
          out[baseRow + dr][baseCol + dc] = "B";
        }
      }

      if (!north && !west) out[baseRow][baseCol] = ".";
      if (!north && !east) out[baseRow][baseCol + scale - 1] = ".";
      if (!south && !west) out[baseRow + scale - 1][baseCol] = ".";
      if (!south && !east) out[baseRow + scale - 1][baseCol + scale - 1] = ".";
    }
  }

  return out.map((row) => row.join(""));
}

const CITY_WORDMARK_HD_GLYPHS = Object.fromEntries(
  Object.entries(CITY_WORDMARK_GLYPHS).map(([key, glyph]) => [key, buildHdGlyph(glyph)])
) as Record<string, CityWordmarkGlyph>;

export const CITY_WORDMARK_HD_GLYPH_ROWS = CITY_WORDMARK_GLYPH_ROWS * HD_SCALE;
export const CITY_WORDMARK_HD_GLYPH_COLS = CITY_WORDMARK_GLYPH_COLS * HD_SCALE;

export type CityWordmarkGlyphSet = {
  glyphs: Record<string, CityWordmarkGlyph>;
  rows: number;
  cols: number;
  scale: number;
};

const CITY_WORDMARK_GLYPH_SETS: Record<CityWordmarkRenderDetail, CityWordmarkGlyphSet> = {
  standard: {
    glyphs: CITY_WORDMARK_GLYPHS,
    rows: CITY_WORDMARK_GLYPH_ROWS,
    cols: CITY_WORDMARK_GLYPH_COLS,
    scale: 1,
  },
  hd: {
    glyphs: CITY_WORDMARK_HD_GLYPHS,
    rows: CITY_WORDMARK_HD_GLYPH_ROWS,
    cols: CITY_WORDMARK_HD_GLYPH_COLS,
    scale: CITY_WORDMARK_HD_GLYPH_COLS / CITY_WORDMARK_GLYPH_COLS,
  },
};

function getCityWordmarkGlyphSet(detail: CityWordmarkRenderDetail = "standard"): CityWordmarkGlyphSet {
  return CITY_WORDMARK_GLYPH_SETS[detail] ?? CITY_WORDMARK_GLYPH_SETS.standard;
}

export function getCityWordmarkGlyphMetrics(detail: CityWordmarkRenderDetail = "standard") {
  const set = getCityWordmarkGlyphSet(detail);
  return { rows: set.rows, cols: set.cols, scale: set.scale };
}

export function getCityWordmarkGlyph(char: string, detail: CityWordmarkRenderDetail = "standard"): CityWordmarkGlyph {
  const key = char.toUpperCase();
  const { glyphs } = getCityWordmarkGlyphSet(detail);
  const glyph = glyphs[key];
  if (!glyph) {
    throw new Error(`Unknown CityWordmark glyph: "${char}"`);
  }
  return glyph;
}
