import { describe, expect, it } from "vitest";
import { batchVoxelRectsToPaths, voxelRectsToPath } from "@/components/wordmark/sim/renderSvg";

describe("voxelRectsToPath", () => {
  it("returns empty string for empty input", () => {
    expect(voxelRectsToPath([], 3)).toBe("");
  });

  it("generates deterministic path data at a given scale", () => {
    const d = voxelRectsToPath(
      [
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 2, y: 0, width: 2, height: 1 },
      ],
      3
    );

    expect(d).toBe("M0 0h3v3h-3ZM6 0h6v3h-6Z");
  });

  it("scales path data when using a higher detail scale", () => {
    const base = voxelRectsToPath([{ x: 1, y: 1, width: 2, height: 1 }], 1);
    const hd = voxelRectsToPath([{ x: 1, y: 1, width: 2, height: 1 }], 2);

    expect(base).toBe("M1 1h2v1h-2Z");
    expect(hd).toBe("M2 2h4v2h-4Z");
  });
});

describe("batchVoxelRectsToPaths", () => {
  it("returns empty batches for empty input", () => {
    expect(
      batchVoxelRectsToPaths([], {
        scale: 3,
        getGroup: () => ({ key: "a", meta: "meta" }),
      })
    ).toEqual([]);
  });

  it("groups rects into deterministic paths by key", () => {
    const batches = batchVoxelRectsToPaths(
      [
        { x: 0, y: 0, width: 1, height: 1, group: "a" },
        { x: 2, y: 0, width: 2, height: 1, group: "a" },
        { x: 0, y: 2, width: 1, height: 1, group: "b" },
      ],
      {
        scale: 3,
        getGroup: (rect) => ({ key: rect.group, meta: rect.group }),
      }
    );

    expect(batches).toEqual([
      { key: "a", meta: "a", d: "M0 0h3v3h-3ZM6 0h6v3h-6Z" },
      { key: "b", meta: "b", d: "M0 6h3v3h-3Z" },
    ]);
  });

  it("skips rects when getGroup returns null", () => {
    const batches = batchVoxelRectsToPaths(
      [{ x: 0, y: 0, width: 1, height: 1 }],
      {
        scale: 3,
        getGroup: () => null,
      }
    );

    expect(batches).toEqual([]);
  });
});
