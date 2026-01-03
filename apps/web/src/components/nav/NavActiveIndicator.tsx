"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type IndicatorState = {
  x: number;
  width: number;
  visible: boolean;
};

export function NavActiveIndicator({
  containerRef,
  activeKey,
  className,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  activeKey: string;
  className?: string;
}) {
  const [state, setState] = useState<IndicatorState>({ x: 0, width: 0, visible: false });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const activeEl = container?.querySelector<HTMLElement>('[data-nav-active="true"]');
    if (!container || !activeEl) {
      setState((prev) => (prev.visible ? { x: prev.x, width: prev.width, visible: false } : prev));
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    if (containerRect.width <= 0 || activeRect.width <= 0) {
      setState((prev) => (prev.visible ? { x: prev.x, width: prev.width, visible: false } : prev));
      return;
    }

    const x = Math.round(activeRect.left - containerRect.left);
    const width = Math.round(activeRect.width);

    setState((prev) => {
      if (prev.visible && prev.x === x && prev.width === width) return prev;
      return { x, width, visible: true };
    });
  }, [containerRef]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(frame);
  }, [activeKey, measure]);

  useEffect(() => {
    let frame: number | null = null;

    const schedule = () => {
      if (frame != null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };

    window.addEventListener("resize", schedule);

    const fonts = document.fonts;
    const onFontEvent = () => schedule();
    if (fonts) {
      void fonts.ready.then(onFontEvent).catch(() => {});
      fonts.addEventListener("loadingdone", onFontEvent);
      fonts.addEventListener("loadingerror", onFontEvent);
    }

    return () => {
      window.removeEventListener("resize", schedule);
      if (fonts) {
        fonts.removeEventListener("loadingdone", onFontEvent);
        fonts.removeEventListener("loadingerror", onFontEvent);
      }
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [measure]);

  return (
    <span aria-hidden className={cn("mdt-nav-active-indicator pointer-events-none absolute inset-x-0 bottom-0 h-4", className)}>
      <span
        className={cn(
          "mdt-nav-active-indicator-position absolute left-0 bottom-1 transition-[transform,opacity] duration-mdt-fast ease-mdt-emphasized",
          state.visible ? "opacity-100" : "opacity-0"
        )}
        style={{ transform: `translateX(${state.x}px)` }}
      >
        <span
          className="mdt-nav-active-indicator-bar block h-[3px] w-px origin-left rounded-full bg-mdt-primary transition-transform duration-mdt-fast ease-mdt-emphasized"
          style={{ transform: `scaleX(${Math.max(1, state.width)})` }}
        />
      </span>
    </span>
  );
}
