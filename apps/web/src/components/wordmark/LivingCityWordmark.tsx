'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { featureFlags } from "@/lib/flags";
import { cn } from "@/lib/cn";
import { LivingCityWordmarkSvg } from "./LivingCityWordmarkSvg";
import { createCityWordmarkLayout } from "./sim/layout";
import { useCityWordmarkSim } from "./sim/useCityWordmarkSim";
import { trackError } from "@/lib/analytics";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";

type LivingCityWordmarkProps = {
  className?: string;
  containerClassName?: string;
  bannerScale?: number;
  preserveAspectRatio?: string;
  sizeMode?: "fixed" | "fluid";
};

const MAX_BANNER_SCALE = 32;

export function LivingCityWordmark({
  className,
  containerClassName,
  bannerScale,
  preserveAspectRatio,
  sizeMode,
}: LivingCityWordmarkProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [autoBannerScale, setAutoBannerScale] = useState<number | null>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isVisualTest =
    typeof window !== "undefined" && (window as { __MDT_VISUAL_TEST__?: boolean }).__MDT_VISUAL_TEST__ === true;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const shouldAnimate =
    featureFlags.wordmarkAnimV1 &&
    featureFlags.wordmarkBannerV1 &&
    !prefersReducedMotion &&
    !isVisualTest &&
    pathname !== "/labs/city-logo";
  const canAnimate = mounted && shouldAnimate;
  const sim = useCityWordmarkSim({ enabled: canAnimate });
  const { peek, setConfig } = sim;
  const baseLayout = useMemo(
    () =>
      createCityWordmarkLayout({
        resolution: sim.config.render.voxelScale,
        detail: sim.config.render.detail,
        sceneScale: 1,
      }),
    [sim.config.render.detail, sim.config.render.voxelScale]
  );

  useEffect(() => {
    if (bannerScale != null) return;
    if (sizeMode !== "fluid") return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    let initFrame: number | null = null;
    const MIN_DIMENSION = 12;
    const update = (width: number, height: number) => {
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      const tooSmall = width < MIN_DIMENSION || height < MIN_DIMENSION;
      if (width <= 0 || height <= 0 || tooSmall) {
        const lastSize = lastSizeRef.current;
        if (!lastSize || lastSize.width < MIN_DIMENSION || lastSize.height < MIN_DIMENSION) return;
        width = lastSize.width;
        height = lastSize.height;
      } else {
        lastSizeRef.current = { width, height };
      }
      const targetScale = Math.max(1, Math.ceil((baseLayout.height * (width / height)) / baseLayout.width));
      const nextScale = Math.min(MAX_BANNER_SCALE, targetScale);
      setAutoBannerScale((prev) => (prev === nextScale ? prev : nextScale));
    };
    const readSize = () => {
      const rect = el.getBoundingClientRect();
      update(rect.width, rect.height);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update(width, height));
    });

    observer.observe(el);
    readSize();
    initFrame = requestAnimationFrame(readSize);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (initFrame) cancelAnimationFrame(initFrame);
    };
  }, [bannerScale, baseLayout.height, baseLayout.width, sizeMode]);

  const rawBannerScale = bannerScale ?? autoBannerScale ?? sim.config.render.bannerScale;
  const resolvedBannerScale = Math.min(
    MAX_BANNER_SCALE,
    Math.max(1, Math.floor(rawBannerScale))
  );

  useEffect(() => {
    if (!canAnimate) return;
    if (resolvedBannerScale == null) return;
    if (resolvedBannerScale === peek().config.render.bannerScale) return;
    setConfig({ render: { bannerScale: resolvedBannerScale } });
  }, [canAnimate, peek, resolvedBannerScale, setConfig]);

  const mergedClassName = cn(
    "mdt-wordmark",
    canAnimate && "mdt-wordmark--animated",
    className
  );
  const mergedContainerClassName = cn("block w-full", containerClassName);

  const fallback = (
    <span
      className={cn(
        "mdt-wordmark flex h-full w-full items-center justify-center text-caption font-semibold uppercase tracking-[0.35em] text-mdt-muted",
        className
      )}
      aria-label="mark downtown"
    >
      mark downtown
    </span>
  );

  const stableNowMs = isVisualTest ? 0 : sim.nowMs;
  const stableActorRects = isVisualTest ? [] : sim.actorRects;

  return (
    <span ref={containerRef} className={mergedContainerClassName}>
      <WordmarkErrorBoundary
        fallback={fallback}
        onError={(error) =>
          trackError("wordmark_banner_error", error, { route: pathname })
        }
      >
        <LivingCityWordmarkSvg
          titleId={titleId}
          descId={descId}
          className={mergedClassName}
          seed={sim.config.seed}
          timeOfDay={sim.config.timeOfDay}
          scheme={sim.config.scheme}
          nowMs={stableNowMs}
          actorRects={stableActorRects}
          voxelScale={sim.config.render.voxelScale}
          renderDetail={sim.config.render.detail}
          bannerScale={resolvedBannerScale}
          sizeMode={sizeMode}
          preserveAspectRatio={preserveAspectRatio}
          skyline={sim.config.skyline}
        />
      </WordmarkErrorBoundary>
    </span>
  );
}

type WordmarkErrorBoundaryProps = {
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
  children: React.ReactNode;
};

class WordmarkErrorBoundary extends React.Component<WordmarkErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
