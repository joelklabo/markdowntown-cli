"use client";

import React from "react";

export type Density = "comfortable" | "compact";

const STORAGE_KEY = "mdt_density";
const COOKIE_KEY = "mdt_density";

type DensityContextValue = {
  density: Density;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
};

const DensityContext = React.createContext<DensityContextValue | null>(null);

function readStoredDensity(): Density | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "comfortable" || value === "compact") return value;
    return null;
  } catch {
    return null;
  }
}

function readCookieDensity(): Density | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]+)`));
    if (!match) return null;
    const value = decodeURIComponent(match[1] ?? "");
    return value === "compact" || value === "comfortable" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredDensity(density: Density) {
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(density)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // ignore
  }
}

export function DensityProvider({
  children,
  initialDensity = "comfortable",
}: {
  children: React.ReactNode;
  initialDensity?: Density;
}) {
  const [density, setDensityState] = React.useState<Density>(initialDensity);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = readStoredDensity() ?? readCookieDensity();
    if (stored && stored !== initialDensity) {
      setDensityState(stored);
    }
    setHydrated(true);
  }, [initialDensity]);

  React.useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.density = density;
    writeStoredDensity(density);
  }, [density, hydrated]);

  const setDensity = React.useCallback((next: Density) => {
    setDensityState(next);
  }, []);

  const toggleDensity = React.useCallback(() => {
    setDensityState((prev) => (prev === "compact" ? "comfortable" : "compact"));
  }, []);

  const value = React.useMemo(() => ({ density, setDensity, toggleDensity }), [density, setDensity, toggleDensity]);

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityContextValue {
  const value = React.useContext(DensityContext);
  if (!value) {
    throw new Error("useDensity must be used within DensityProvider");
  }
  return value;
}
