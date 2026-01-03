import { describe, expect, it } from "vitest";
import {
  CITY_WORDMARK_GLYPHS,
  CITY_WORDMARK_GLYPH_COLS,
  CITY_WORDMARK_GLYPH_ROWS,
  CITY_WORDMARK_HD_GLYPH_COLS,
  CITY_WORDMARK_HD_GLYPH_ROWS,
} from "@/components/wordmark/sim/glyphs";
import {
  createCityWordmarkLayout,
  createCityWordmarkSkylineMask,
  getIntegerScaleToFitHeight,
} from "@/components/wordmark/sim/layout";

describe("createCityWordmarkLayout", () => {
  it("generates a deterministic rect layout for the default text", () => {
    const a = createCityWordmarkLayout();
    const b = createCityWordmarkLayout();
    expect(a).toEqual(b);
    expect(a.width).toBeGreaterThan(0);
    expect(a.sceneWidth).toBeGreaterThan(0);
    expect(a.sceneWidth).toBeGreaterThanOrEqual(a.width);
    expect(a.height).toBeGreaterThan(0);
    expect(a.rects.length).toBeGreaterThan(0);
  });

  it("supports expanding the scene width beyond the text", () => {
    const base = createCityWordmarkLayout({ sceneScale: 1 });
    const expanded = createCityWordmarkLayout({ sceneScale: 3 });
    expect(expanded.width).toBe(base.width);
    expect(expanded.sceneWidth).toBe(base.width * 3);
  });

  it("tracks resolution and grid scale", () => {
    const layout = createCityWordmarkLayout({ resolution: 3, detail: "hd" });
    expect(layout.resolution).toBe(3);
    expect(layout.gridScale).toBe(layout.resolution * layout.detailScale);
  });

  it("scales layout dimensions with resolution", () => {
    const base = createCityWordmarkLayout({ resolution: 1, detail: "standard" });
    const scaled = createCityWordmarkLayout({ resolution: 3, detail: "standard" });
    expect(scaled.width).toBe(base.width * 3);
    expect(scaled.height).toBe(base.height * 3);
  });

  it("includes all glyphs needed for MARKDOWNTOWN", () => {
    const required = ["M", "A", "R", "K", "D", "O", "W", "N", "T"] as const;
    for (const ch of required) {
      expect(CITY_WORDMARK_GLYPHS[ch]).toBeDefined();
    }
  });

  it("uses HD glyph metrics when detail is hd", () => {
    const hd = createCityWordmarkLayout({ detail: "hd" });
    expect(hd.glyphCols).toBe(CITY_WORDMARK_HD_GLYPH_COLS);
    expect(hd.glyphRows).toBe(CITY_WORDMARK_HD_GLYPH_ROWS);
    expect(hd.detailScale).toBe(CITY_WORDMARK_HD_GLYPH_COLS / CITY_WORDMARK_GLYPH_COLS);
    expect(hd.topPadding).toBeGreaterThanOrEqual(CITY_WORDMARK_GLYPH_ROWS);
  });

  it("scales layout dimensions for HD detail", () => {
    const standard = createCityWordmarkLayout({ detail: "standard" });
    const hd = createCityWordmarkLayout({ detail: "hd" });

    expect(hd.glyphCols).toBeGreaterThan(standard.glyphCols);
    expect(hd.glyphRows).toBeGreaterThan(standard.glyphRows);
    expect(hd.width).toBeGreaterThan(standard.width);
    expect(hd.height).toBeGreaterThan(standard.height);
  });
});

describe("createCityWordmarkSkylineMask", () => {
  it("is deterministic for a given seed", () => {
    const layout = createCityWordmarkLayout();

    const a = createCityWordmarkSkylineMask({ width: layout.width, baselineY: layout.baselineY, seed: "seed" });
    const b = createCityWordmarkSkylineMask({ width: layout.width, baselineY: layout.baselineY, seed: "seed" });
    expect(a).toEqual(b);
  });

  it("respects height and segment width ranges", () => {
    const layout = createCityWordmarkLayout();

    const rects = createCityWordmarkSkylineMask({
      width: layout.width,
      baselineY: layout.baselineY,
      seed: "seed",
      minHeight: 4,
      maxHeight: 4,
      minSegmentWidth: 1,
      maxSegmentWidth: 1,
    });

    expect(rects.length).toBe(layout.width);
    for (const r of rects) {
      expect(r.height).toBe(4);
      expect(r.width).toBe(1);
      expect(r.y).toBe(layout.baselineY - 4);
    }
  });

  it("supports taller skyline masks when scaled for HD detail", () => {
    const standard = createCityWordmarkLayout({ detail: "standard" });
    const hd = createCityWordmarkLayout({ detail: "hd" });

    const standardHeight = 2 * standard.detailScale;
    const hdHeight = 2 * hd.detailScale;

    const standardMask = createCityWordmarkSkylineMask({
      width: standard.width,
      baselineY: standard.baselineY,
      seed: "seed",
      minHeight: standardHeight,
      maxHeight: standardHeight,
      minSegmentWidth: 1,
      maxSegmentWidth: 1,
    });
    const hdMask = createCityWordmarkSkylineMask({
      width: hd.width,
      baselineY: hd.baselineY,
      seed: "seed",
      minHeight: hdHeight,
      maxHeight: hdHeight,
      minSegmentWidth: 1,
      maxSegmentWidth: 1,
    });

    expect(standardMask.length).toBeGreaterThan(0);
    expect(hdMask.length).toBeGreaterThan(0);
    expect(Math.max(...hdMask.map((r) => r.height))).toBeGreaterThan(Math.max(...standardMask.map((r) => r.height)));
  });
});

describe("getIntegerScaleToFitHeight", () => {
  it("returns an integer scale that fits within the target height", () => {
    const layout = createCityWordmarkLayout();
    expect(getIntegerScaleToFitHeight(9, layout.height)).toBe(1);
    expect(getIntegerScaleToFitHeight(100, layout.height)).toBeGreaterThan(1);
  });
});
