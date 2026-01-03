import { describe, it, expect, vi } from "vitest";
import { memoize } from "@/lib/cache";

describe("memoize", () => {
  it("returns cached result for identical key", async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const wrapped = memoize(fn as unknown as (...args: unknown[]) => Promise<number>);
    const first = await wrapped("a", 2);
    const second = await wrapped("a", 2);
    expect(first).toBe(4);
    expect(second).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("differentiates keys", async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const wrapped = memoize(fn as unknown as (...args: unknown[]) => Promise<number>);
    await wrapped("a", 2);
    await wrapped("b", 2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
