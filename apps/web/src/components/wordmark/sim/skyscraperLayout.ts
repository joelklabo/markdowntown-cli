import { createRng } from "./rng";

/**
 * Skyscraper Layout System
 *
 * Creates a cityscape where tall buildings have window grids,
 * and the LIT windows spell out text against dark building facades.
 */

export type SkyscraperBuilding = {
  x: number;
  width: number;
  windowCols: number;
  windowStartCol: number; // Starting column index in the global window grid
};

export type SkyscraperWindow = {
  x: number;
  y: number;
  width: number;
  height: number;
  lit: boolean;
  buildingIndex: number;
};

export type SkyscraperLayout = {
  sceneWidth: number;
  sceneHeight: number;
  buildings: SkyscraperBuilding[];
  windows: SkyscraperWindow[];
  windowSize: number;
  windowGap: number;
  buildingGap: number;
  textStartY: number;
  skyGap: number; // Gap at the top between buildings for sky to show through
};

// Bitmap font - each character is a grid where 1 = lit, 0 = dark
// Using a 5x7 font for good readability at small sizes
const BITMAP_FONT: Record<string, number[][]> = {
  M: [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  A: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  R: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  K: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 0, 0, 0],
    [1, 0, 1, 0, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  D: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  O: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  W: [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 0, 1, 1],
    [1, 0, 0, 0, 1],
  ],
  N: [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  T: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  " ": [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
};

const FONT_HEIGHT = 7;
const CHAR_SPACING = 1; // Windows between characters

export type SkyscraperLayoutOptions = {
  text?: string;
  seed?: string;
  /** Target scene width in pixels */
  targetWidth?: number;
  /** Target scene height in pixels */
  targetHeight?: number;
  /** Size of each window in pixels */
  windowSize?: number;
  /** Gap between windows in pixels */
  windowGap?: number;
  /** Gap between buildings in pixels */
  buildingGap?: number;
  /** Number of window rows above the text */
  rowsAboveText?: number;
  /** Number of window rows below the text */
  rowsBelowText?: number;
};

const DEFAULT_OPTIONS: Required<SkyscraperLayoutOptions> = {
  text: "MARK DOWNTOWN",
  seed: "markdowntown",
  targetWidth: 800,
  targetHeight: 200,
  windowSize: 3,
  windowGap: 2,
  buildingGap: 6,
  rowsAboveText: 8,
  rowsBelowText: 4,
};

function getCharWidth(char: string): number {
  const glyph = BITMAP_FONT[char.toUpperCase()];
  return glyph?.[0]?.length ?? 3;
}

function getTextWidth(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    if (i > 0) width += CHAR_SPACING;
    width += getCharWidth(text[i]);
  }
  return width;
}

function isWindowLit(text: string, windowCol: number, windowRow: number, textStartRow: number): boolean {
  // Window row relative to text
  const textRow = windowRow - textStartRow;
  if (textRow < 0 || textRow >= FONT_HEIGHT) return false;

  // Find which character and column within character
  let col = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase();
    const charWidth = getCharWidth(char);

    if (windowCol >= col && windowCol < col + charWidth) {
      const charCol = windowCol - col;
      const glyph = BITMAP_FONT[char];
      return glyph?.[textRow]?.[charCol] === 1;
    }

    col += charWidth + CHAR_SPACING;
  }

  return false;
}

export function createSkyscraperLayout(options: SkyscraperLayoutOptions = {}): SkyscraperLayout {
  const text = options.text ?? DEFAULT_OPTIONS.text;
  const seed = options.seed ?? DEFAULT_OPTIONS.seed;
  const _targetWidth = options.targetWidth ?? DEFAULT_OPTIONS.targetWidth;
  const _targetHeight = options.targetHeight ?? DEFAULT_OPTIONS.targetHeight;
  const windowSize = options.windowSize ?? DEFAULT_OPTIONS.windowSize;
  const windowGap = options.windowGap ?? DEFAULT_OPTIONS.windowGap;
  const buildingGap = options.buildingGap ?? DEFAULT_OPTIONS.buildingGap;
  const rowsAboveText = options.rowsAboveText ?? DEFAULT_OPTIONS.rowsAboveText;
  const rowsBelowText = options.rowsBelowText ?? DEFAULT_OPTIONS.rowsBelowText;

  const rng = createRng(`${seed}:skyscraper`);

  // Calculate text dimensions in window units
  const textWidthInWindows = getTextWidth(text);
  const textHeightInWindows = FONT_HEIGHT;
  const totalRowsInWindows = rowsAboveText + textHeightInWindows + rowsBelowText;

  // Calculate the window cell size (window + gap)
  const cellSize = windowSize + windowGap;

  // Calculate how many window columns we can fit, centered around the text
  const paddingCols = 4; // Extra columns on each side
  const totalCols = textWidthInWindows + paddingCols * 2;

  // Calculate scene dimensions
  const sceneWidth = totalCols * cellSize + buildingGap * 2;
  const sceneHeight = totalRowsInWindows * cellSize;

  // Generate buildings
  const buildings: SkyscraperBuilding[] = [];
  const minBuildingCols = 6;
  const maxBuildingCols = 14;

  let x = 0;
  let windowColStart = 0;

  while (x < sceneWidth) {
    const remainingWidth = sceneWidth - x;
    const maxPossibleCols = Math.floor(remainingWidth / cellSize);

    if (maxPossibleCols < minBuildingCols) {
      // Last building takes remaining space
      const buildingWidth = remainingWidth;
      const windowCols = Math.max(1, Math.floor((buildingWidth - buildingGap) / cellSize));
      buildings.push({
        x,
        width: buildingWidth,
        windowCols,
        windowStartCol: windowColStart,
      });
      break;
    }

    const windowCols = Math.min(maxPossibleCols, rng.nextInt(minBuildingCols, maxBuildingCols + 1));
    const buildingWidth = windowCols * cellSize + buildingGap;

    buildings.push({
      x,
      width: buildingWidth,
      windowCols,
      windowStartCol: windowColStart,
    });

    x += buildingWidth;
    windowColStart += windowCols;
  }

  // Generate windows for all buildings
  const windows: SkyscraperWindow[] = [];
  const textStartRow = rowsAboveText;

  // Calculate horizontal offset to center text
  const totalWindowCols = buildings.reduce((sum, b) => sum + b.windowCols, 0);
  const textOffset = Math.floor((totalWindowCols - textWidthInWindows) / 2);

  for (let buildingIndex = 0; buildingIndex < buildings.length; buildingIndex++) {
    const building = buildings[buildingIndex];
    const buildingLeftPadding = Math.floor(buildingGap / 2);

    for (let localCol = 0; localCol < building.windowCols; localCol++) {
      const globalCol = building.windowStartCol + localCol;
      const textCol = globalCol - textOffset; // Column relative to text start

      for (let row = 0; row < totalRowsInWindows; row++) {
        const lit = isWindowLit(text, textCol, row, textStartRow);

        // Add some random ambient lit windows (not part of text)
        const ambientLit = !lit && rng.nextFloat() < 0.03;

        windows.push({
          x: building.x + buildingLeftPadding + localCol * cellSize,
          y: row * cellSize,
          width: windowSize,
          height: windowSize,
          lit: lit || ambientLit,
          buildingIndex,
        });
      }
    }
  }

  return {
    sceneWidth,
    sceneHeight,
    buildings,
    windows,
    windowSize,
    windowGap,
    buildingGap,
    textStartY: textStartRow * cellSize,
    skyGap: Math.floor(buildingGap * 0.6),
  };
}
