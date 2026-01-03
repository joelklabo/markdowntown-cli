import { describe, expect, it } from "vitest";
import { createRng } from "@/components/wordmark/sim/rng";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng("seed");
    const b = createRng("seed");

    const seqA = Array.from({ length: 8 }, () => a.nextFloat());
    const seqB = Array.from({ length: 8 }, () => b.nextFloat());
    expect(seqA).toEqual(seqB);
  });

  it("produces a stable shuffle for a given seed", () => {
    const rng = createRng("markdowntown");
    expect(rng.shuffle([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 4, 5, 6, 3, 7, 2]);
  });

  it("picks deterministically for a given seed", () => {
    const rng = createRng("pick-seed");
    const values = ["a", "b", "c", "d"] as const;
    expect([rng.pick(values), rng.pick(values), rng.pick(values)]).toEqual(["b", "b", "b"]);
  });
});
