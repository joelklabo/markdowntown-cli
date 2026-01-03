/// <reference types="vitest" />
import "@testing-library/jest-dom";

// Ensure React act warnings are suppressed in the test environment.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Radix Tooltip and Drawer use ResizeObserver; jsdom doesn't provide it by default.
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const globalWithRO = globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver };
globalWithRO.ResizeObserver = ResizeObserver;

// matchMedia is used in responsive guards; jsdom doesn't implement it.
const globalWithMM = globalThis as typeof globalThis & {
  matchMedia?: (query: string) => MediaQueryList;
};
if (!globalWithMM.matchMedia) {
  globalWithMM.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
