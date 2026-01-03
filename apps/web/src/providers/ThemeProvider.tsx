"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const COOKIE_KEY = "mdt_theme";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readDocumentTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : null;
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function readCookieTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]+)`));
    if (!match) return null;
    const value = decodeURIComponent(match[1] ?? "");
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function readPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
}

function writeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // ignore
  }
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: Theme | null;
}) {
  const [theme, setTheme] = useState<Theme>(() => initialTheme ?? "light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme() ?? readCookieTheme() ?? readDocumentTheme();
    const preferred = stored ?? readPreferredTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme((prev) => (prev === preferred ? prev : preferred));
    setHydrated(true);

    if (!stored && typeof window !== "undefined" && window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = (event: MediaQueryListEvent) => {
        setTheme(event.matches ? "dark" : "light");
      };
      if (media.addEventListener) {
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
      }
      media.addListener(onChange);
      return () => media.removeListener(onChange);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(theme);
    writeTheme(theme);
  }, [theme, hydrated]);

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
