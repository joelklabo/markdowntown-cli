export type CityWordmarkRng = {
  nextFloat: () => number;
  nextInt: (minInclusive: number, maxExclusive: number) => number;
  pick: <T>(values: readonly T[]) => T;
  shuffle: <T>(values: readonly T[]) => T[];
};

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32Next(state: number): number {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export function createRng(seed: string): CityWordmarkRng {
  let state = fnv1a32(seed);
  if (state === 0) state = 0x6d2b79f5;

  function nextUint32() {
    state = mulberry32Next(state);
    return state;
  }

  function nextFloat() {
    return nextUint32() / 2 ** 32;
  }

  function nextInt(minInclusive: number, maxExclusive: number) {
    if (!Number.isFinite(minInclusive) || !Number.isFinite(maxExclusive)) {
      throw new Error("rng.nextInt: bounds must be finite numbers");
    }
    if (Math.floor(minInclusive) !== minInclusive || Math.floor(maxExclusive) !== maxExclusive) {
      throw new Error("rng.nextInt: bounds must be integers");
    }
    if (maxExclusive <= minInclusive) {
      throw new Error("rng.nextInt: maxExclusive must be greater than minInclusive");
    }

    const span = maxExclusive - minInclusive;
    return minInclusive + (nextUint32() % span);
  }

  function pick<T>(values: readonly T[]) {
    if (values.length === 0) {
      throw new Error("rng.pick: cannot pick from an empty list");
    }
    return values[nextInt(0, values.length)];
  }

  function shuffle<T>(values: readonly T[]) {
    const out = values.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = nextInt(0, i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  return { nextFloat, nextInt, pick, shuffle };
}

