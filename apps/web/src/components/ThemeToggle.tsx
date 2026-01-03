"use client";

import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "./ui/Button";
import { useCallback, useRef, useSyncExternalStore } from "react";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const mountedRef = useRef(false);
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      const schedule = typeof queueMicrotask === "function" ? queueMicrotask : (cb: () => void) => setTimeout(cb, 0);
      schedule(onStoreChange);
    }
    return () => {};
  }, []);
  const getSnapshot = useCallback(() => mountedRef.current, []);
  const getServerSnapshot = useCallback(() => false, []);
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isDark = mounted ? theme === "dark" : false;

  return (
    <Button
      variant="ghost"
      size="xs"
      type="button"
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={toggle}
      className="gap-mdt-1"
    >
      <span aria-hidden>{isDark ? "🌙" : "☀️"}</span>
      <span className="hidden sm:inline">{isDark ? "Dark" : "Light"}</span>
    </Button>
  );
}
