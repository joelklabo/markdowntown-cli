'use client';

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { SiteNav } from "@/components/SiteNav";
import { CityLogoControls, type CityLogoPreviewWidthMode } from "@/components/wordmark/CityLogoControls";
import { LivingCityWordmarkSvg } from "@/components/wordmark/LivingCityWordmarkSvg";
import { WordmarkLegend } from "@/components/wordmark/WordmarkLegend";
import { getDefaultCityWordmarkConfig } from "@/components/wordmark/sim/config";
import { createCityWordmarkLayout } from "@/components/wordmark/sim/layout";
import { dispatchCityWordmarkEvent } from "@/components/wordmark/sim/events";
import { createCityWordmarkEngine, type CityWordmarkEngineSnapshot } from "@/components/wordmark/sim/engine";
import { normalizeVoxelScale } from "@/components/wordmark/sim/renderSvg";
import type { CityWordmarkConfig } from "@/components/wordmark/sim/types";
import { useCityWordmarkSim } from "@/components/wordmark/sim/useCityWordmarkSim";

export type CityLogoLabClientProps = {
  snapshotMode?: boolean;
  initialConfig: CityWordmarkConfig;
  initialPreviewWidthMode?: CityLogoPreviewWidthMode;
  initialPlaying?: boolean;
  initialEvent?: "ambulance" | "search" | "publish" | "upload" | "login" | "command";
};

const DEFAULT_CONFIG = getDefaultCityWordmarkConfig();
const SNAPSHOT_BASE_VOXEL_SCALE = 3;
const HEADER_DEFAULTS = {
  bannerHeight: 48,
  bannerHeightMd: 56,
  navMinHeight: 56,
  navMinHeightMd: 64,
  navPaddingY: 12,
  navPaddingYMd: 16,
};

function formatFloat(value: number, digits: number): string {
  return Number(value.toFixed(digits)).toString();
}

function formatBool(value: boolean): string {
  return value ? "1" : "0";
}

function buildCityLogoLabSearchParams(options: {
  config: CityWordmarkConfig;
  shareTimeOfDay: number;
  previewWidthMode: CityLogoPreviewWidthMode;
  playing: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  const { config, shareTimeOfDay, previewWidthMode, playing } = options;

  if (config.seed !== DEFAULT_CONFIG.seed) params.set("seed", config.seed);
  if (config.density !== DEFAULT_CONFIG.density) params.set("density", config.density);
  if (config.scheme !== DEFAULT_CONFIG.scheme) params.set("scheme", config.scheme);
  if (Math.abs(config.timeScale - DEFAULT_CONFIG.timeScale) > 0.0001) params.set("timeScale", formatFloat(config.timeScale, 2));
  if (Math.abs(shareTimeOfDay - DEFAULT_CONFIG.timeOfDay) > 0.0001) params.set("timeOfDay", formatFloat(shareTimeOfDay, 3));

  if (config.render.voxelScale !== DEFAULT_CONFIG.render.voxelScale) params.set("voxelScale", String(config.render.voxelScale));
  if (config.render.bannerScale !== DEFAULT_CONFIG.render.bannerScale) {
    params.set("bannerScale", String(config.render.bannerScale));
  }
  if (config.render.detail !== DEFAULT_CONFIG.render.detail) params.set("detail", config.render.detail);

  if (config.skyline.minHeight !== DEFAULT_CONFIG.skyline.minHeight) params.set("skyMinH", String(config.skyline.minHeight));
  if (config.skyline.maxHeight !== DEFAULT_CONFIG.skyline.maxHeight) params.set("skyMaxH", String(config.skyline.maxHeight));
  if (config.skyline.minSegmentWidth !== DEFAULT_CONFIG.skyline.minSegmentWidth) {
    params.set("skyMinW", String(config.skyline.minSegmentWidth));
  }
  if (config.skyline.maxSegmentWidth !== DEFAULT_CONFIG.skyline.maxSegmentWidth) {
    params.set("skyMaxW", String(config.skyline.maxSegmentWidth));
  }

  if (config.actors.cars !== DEFAULT_CONFIG.actors.cars) params.set("aCars", formatBool(config.actors.cars));
  if (config.actors.trucks !== DEFAULT_CONFIG.actors.trucks) params.set("aTrucks", formatBool(config.actors.trucks));
  if (config.actors.streetlights !== DEFAULT_CONFIG.actors.streetlights) params.set("aStreetlights", formatBool(config.actors.streetlights));
  if (config.actors.pedestrians !== DEFAULT_CONFIG.actors.pedestrians) params.set("aPedestrians", formatBool(config.actors.pedestrians));
  if (config.actors.dogs !== DEFAULT_CONFIG.actors.dogs) params.set("aDogs", formatBool(config.actors.dogs));
  if (config.actors.ambulance !== DEFAULT_CONFIG.actors.ambulance) params.set("aAmbulance", formatBool(config.actors.ambulance));

  if (previewWidthMode !== "fixed") params.set("previewWidth", previewWidthMode);
  if (!playing) params.set("play", "0");

  return params;
}

export function CityLogoLabClient({
  snapshotMode = false,
  initialConfig,
  initialPreviewWidthMode,
  initialPlaying,
  initialEvent,
}: CityLogoLabClientProps) {
  const [engine] = useState(() =>
    createCityWordmarkEngine({
      initialConfig,
      initialPlaying: snapshotMode ? false : (initialPlaying ?? true),
    })
  );

  const sim = useCityWordmarkSim({ enabled: true, engine });
  const [snapshotOverride, setSnapshotOverride] = useState<CityWordmarkEngineSnapshot | null>(() => {
    if (!snapshotMode) return null;
    if (initialEvent) return null;
    return engine.getSnapshot();
  });
  const id = useId();
  const [previewWidthMode, setPreviewWidthMode] = useState<CityLogoPreviewWidthMode>(initialPreviewWidthMode ?? "fixed");
  const [shareTimeOfDay, setShareTimeOfDay] = useState(() => initialConfig.timeOfDay);
  const [headerBannerHeight, setHeaderBannerHeight] = useState(HEADER_DEFAULTS.bannerHeight);
  const [headerBannerHeightMd, setHeaderBannerHeightMd] = useState(HEADER_DEFAULTS.bannerHeightMd);
  const [headerNavMinHeight, setHeaderNavMinHeight] = useState(HEADER_DEFAULTS.navMinHeight);
  const [headerNavMinHeightMd, setHeaderNavMinHeightMd] = useState(HEADER_DEFAULTS.navMinHeightMd);
  const [headerNavPaddingY, setHeaderNavPaddingY] = useState(HEADER_DEFAULTS.navPaddingY);
  const [headerNavPaddingYMd, setHeaderNavPaddingYMd] = useState(HEADER_DEFAULTS.navPaddingYMd);
  const [applyHeaderToShell, setApplyHeaderToShell] = useState(false);

  const headerVars = useMemo(
    () => ({
      "--mdt-site-header-banner-height": `${headerBannerHeight}px`,
      "--mdt-site-header-banner-height-md": `${headerBannerHeightMd}px`,
      "--mdt-site-header-nav-min-height": `${headerNavMinHeight}px`,
      "--mdt-site-header-nav-min-height-md": `${headerNavMinHeightMd}px`,
      "--mdt-site-header-nav-padding-y": `${headerNavPaddingY}px`,
      "--mdt-site-header-nav-padding-y-md": `${headerNavPaddingYMd}px`,
    }),
    [
      headerBannerHeight,
      headerBannerHeightMd,
      headerNavMinHeight,
      headerNavMinHeightMd,
      headerNavPaddingY,
      headerNavPaddingYMd,
    ]
  );
  const headerStyle = useMemo(() => headerVars as CSSProperties, [headerVars]);
  const shareQuery = buildCityLogoLabSearchParams({
    config: sim.config,
    shareTimeOfDay,
    previewWidthMode,
    playing: sim.playing,
  }).toString();
  const headerCssSnippet = useMemo(() => {
    return [
      ":root {",
      `  --mdt-site-header-banner-height: ${headerBannerHeight}px;`,
      `  --mdt-site-header-nav-min-height: ${headerNavMinHeight}px;`,
      `  --mdt-site-header-nav-padding-y: ${headerNavPaddingY}px;`,
      "}",
      "",
      "@media (min-width: 768px) {",
      "  :root {",
      `    --mdt-site-header-banner-height-md: ${headerBannerHeightMd}px;`,
      `    --mdt-site-header-nav-min-height-md: ${headerNavMinHeightMd}px;`,
      `    --mdt-site-header-nav-padding-y-md: ${headerNavPaddingYMd}px;`,
      "  }",
      "}",
    ].join("\n");
  }, [
    headerBannerHeight,
    headerBannerHeightMd,
    headerNavMinHeight,
    headerNavMinHeightMd,
    headerNavPaddingY,
    headerNavPaddingYMd,
  ]);

  const resetHeaderVars = useCallback(() => {
    setHeaderBannerHeight(HEADER_DEFAULTS.bannerHeight);
    setHeaderBannerHeightMd(HEADER_DEFAULTS.bannerHeightMd);
    setHeaderNavMinHeight(HEADER_DEFAULTS.navMinHeight);
    setHeaderNavMinHeightMd(HEADER_DEFAULTS.navMinHeightMd);
    setHeaderNavPaddingY(HEADER_DEFAULTS.navPaddingY);
    setHeaderNavPaddingYMd(HEADER_DEFAULTS.navPaddingYMd);
  }, []);

  const copyHeaderCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(headerCssSnippet);
    } catch {
      window.prompt("Copy header CSS:", headerCssSnippet);
    }
  }, [headerCssSnippet]);

  useEffect(() => {
    if (snapshotMode) return;
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const entries = Object.entries(headerVars);

    if (!applyHeaderToShell) {
      entries.forEach(([key]) => root.style.removeProperty(key));
      root.removeAttribute("data-header-lab");
      return;
    }

    root.dataset.headerLab = "true";
    entries.forEach(([key, value]) => root.style.setProperty(key, value));
    return () => {
      entries.forEach(([key]) => root.style.removeProperty(key));
      root.removeAttribute("data-header-lab");
    };
  }, [applyHeaderToShell, headerVars, snapshotMode]);

  useEffect(() => {
    if (snapshotMode) return;

    const handle = window.setTimeout(() => {
      const base = window.location.pathname;
      const next = shareQuery ? `${base}?${shareQuery}` : base;
      const current = window.location.pathname + window.location.search;
      if (next === current) return;
      window.history.replaceState(null, "", next);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [shareQuery, snapshotMode]);

  const copyLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.search = shareQuery ? `?${shareQuery}` : "";
    const text = url.toString();

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy link:", text);
    }
  }, [shareQuery]);

  useEffect(() => {
    if (!snapshotMode && initialEvent) {
      const ts = Date.now();
      switch (initialEvent) {
        case "ambulance":
          dispatchCityWordmarkEvent({ type: "alert", kind: "ambulance", ts });
          return;
        case "search":
          dispatchCityWordmarkEvent({ type: "search", query: "mark downtown", ts });
          return;
        case "publish":
          dispatchCityWordmarkEvent({ type: "publish", kind: "artifact", ts });
          return;
        case "upload":
          dispatchCityWordmarkEvent({ type: "upload", kind: "file", ts });
          return;
        case "login":
          dispatchCityWordmarkEvent({ type: "login", method: "oauth", ts });
          return;
        case "command":
          dispatchCityWordmarkEvent({ type: "command_palette_open", origin: "labs", ts });
          return;
      }
      return;
    }

    if (!snapshotMode) return;

    const ts = 42_000;
    switch (initialEvent) {
      case "ambulance":
        dispatchCityWordmarkEvent({ type: "alert", kind: "ambulance", ts });
        break;
      case "search":
        dispatchCityWordmarkEvent({ type: "search", query: "mark downtown", ts });
        break;
      case "publish":
        dispatchCityWordmarkEvent({ type: "publish", kind: "artifact", ts });
        break;
      case "upload":
        dispatchCityWordmarkEvent({ type: "upload", kind: "file", ts });
        break;
      case "login":
        dispatchCityWordmarkEvent({ type: "login", method: "oauth", ts });
        break;
      case "command":
        dispatchCityWordmarkEvent({ type: "command_palette_open", origin: "labs", ts });
        break;
      default:
        break;
    }

    if (initialEvent) {
      const nextSnapshot = engine.getSnapshot();
      const schedule =
        typeof queueMicrotask === "function"
          ? queueMicrotask
          : (cb: () => void) => Promise.resolve().then(cb);
      schedule(() => setSnapshotOverride(nextSnapshot));
    }
  }, [engine, initialEvent, snapshotMode]);

  const renderConfig = snapshotOverride?.config ?? sim.config;
  const renderNowMs = snapshotMode ? 42_000 : (snapshotOverride?.nowMs ?? sim.nowMs);
  const renderActorRects = snapshotOverride?.actorRects ?? sim.actorRects;
  const snapshotSize = useMemo(() => {
    if (!snapshotMode) return null;
    const resolution = normalizeVoxelScale(renderConfig.render.voxelScale);
    const bannerScale = normalizeVoxelScale(renderConfig.render.bannerScale);
    const layout = createCityWordmarkLayout({
      resolution,
      sceneScale: bannerScale,
      detail: renderConfig.render.detail,
    });
    const viewWidth = layout.sceneWidth / layout.detailScale;
    const viewHeight = layout.height / layout.detailScale;
    const baseWidth = viewWidth / resolution;
    const baseHeight = viewHeight / resolution;
    return {
      width: Math.round(baseWidth * SNAPSHOT_BASE_VOXEL_SCALE),
      height: Math.round(baseHeight * SNAPSHOT_BASE_VOXEL_SCALE),
    };
  }, [renderConfig.render.bannerScale, renderConfig.render.detail, renderConfig.render.voxelScale, snapshotMode]);

  const preview = (
    <Card className="p-mdt-6">
      <div
        data-testid="city-logo-preview"
        data-snapshot-ready={!snapshotMode || snapshotOverride ? "true" : "false"}
        className={snapshotMode ? "flex items-center justify-center" : "flex items-center justify-center pb-px md:pb-0"}
        style={snapshotMode && snapshotSize ? { height: `${snapshotSize.height}px` } : undefined}
      >
        <LivingCityWordmarkSvg
          titleId={`${id}-title`}
          descId={`${id}-desc`}
          className={previewWidthMode === "full" ? "w-full h-auto" : "max-w-[1100px] h-auto !w-auto"}
          seed={renderConfig.seed}
          timeOfDay={renderConfig.timeOfDay}
          scheme={renderConfig.scheme}
          nowMs={renderNowMs}
          actorRects={renderActorRects}
          voxelScale={renderConfig.render.voxelScale}
          renderDetail={renderConfig.render.detail}
          bannerScale={renderConfig.render.bannerScale}
          forceSolidGrid={snapshotMode}
          skyline={renderConfig.skyline}
        />
      </div>
    </Card>
  );

  if (snapshotMode) {
    return (
      <div className="fixed inset-0 z-[999] overflow-hidden bg-mdt-bg p-mdt-6">
        {preview}
      </div>
    );
  }

  return (
    <div className="p-mdt-6 space-y-mdt-6">
      <CityLogoControls
        sim={sim}
        eventOrigin="labs"
        preview={{ widthMode: previewWidthMode, setWidthMode: setPreviewWidthMode }}
        share={{ onCopyLink: copyLink, onShareTimeOfDay: setShareTimeOfDay }}
        actions={
          <Button size="xs" variant="ghost" onClick={copyHeaderCss}>
            Copy header CSS
          </Button>
        }
        legend={<WordmarkLegend />}
      />

      <Card className="p-mdt-6 space-y-mdt-4">
        <div className="flex flex-wrap items-start justify-between gap-mdt-2">
          <div className="space-y-1">
            <div className="text-body-sm font-medium text-mdt-text">Header preview</div>
            <div className="text-caption text-mdt-muted">Adjust banner + nav sizing variables.</div>
          </div>
          <Button size="xs" variant="secondary" onClick={resetHeaderVars}>
            Reset defaults
          </Button>
        </div>
        <Checkbox checked={applyHeaderToShell} onChange={(e) => setApplyHeaderToShell(e.target.checked)}>
          <span className="text-caption text-mdt-muted">Apply to live header</span>
        </Checkbox>
        <div className="grid gap-mdt-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-mdt-1">
            <div className="text-caption text-mdt-muted">Banner height</div>
            <Input
              type="number"
              min={48}
              max={120}
              value={headerBannerHeight}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setHeaderBannerHeight(Math.min(120, Math.max(48, next)));
              }}
            />
          </div>
          <div className="space-y-mdt-1">
            <div className="text-caption text-mdt-muted">Banner height (md)</div>
            <Input
              type="number"
              min={56}
              max={140}
              value={headerBannerHeightMd}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setHeaderBannerHeightMd(Math.min(140, Math.max(56, next)));
              }}
            />
          </div>
          <div className="space-y-mdt-1">
            <div className="text-caption text-mdt-muted">Nav min height</div>
            <Input
              type="number"
              min={56}
              max={140}
              value={headerNavMinHeight}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setHeaderNavMinHeight(Math.min(140, Math.max(56, next)));
              }}
            />
          </div>
          <div className="space-y-mdt-1">
            <div className="text-caption text-mdt-muted">Nav min height (md)</div>
            <Input
              type="number"
              min={64}
              max={160}
              value={headerNavMinHeightMd}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setHeaderNavMinHeightMd(Math.min(160, Math.max(64, next)));
              }}
            />
          </div>
          <div className="space-y-mdt-1">
            <div className="text-caption text-mdt-muted">Nav padding Y</div>
            <Input
              type="number"
              min={12}
              max={32}
              value={headerNavPaddingY}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setHeaderNavPaddingY(Math.min(32, Math.max(12, next)));
              }}
            />
          </div>
          <div className="space-y-mdt-1">
            <div className="text-caption text-mdt-muted">Nav padding Y (md)</div>
            <Input
              type="number"
              min={16}
              max={40}
              value={headerNavPaddingYMd}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setHeaderNavPaddingYMd(Math.min(40, Math.max(16, next)));
              }}
            />
          </div>
        </div>
        <div className="rounded-mdt-lg border border-mdt-border bg-mdt-surface" style={headerStyle}>
          <SiteNav sticky={false} />
        </div>
      </Card>

      {preview}

      <Card className="p-mdt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-mdt-3 text-caption text-mdt-muted">
          <div className="space-y-1">
            <div className="text-mdt-muted">Seed</div>
            <div className="text-mdt-text font-mono break-all">{sim.config.seed}</div>
          </div>
          <div className="space-y-1">
            <div className="text-mdt-muted">Density</div>
            <div className="text-mdt-text">{sim.config.density}</div>
          </div>
          <div className="space-y-1">
            <div className="text-mdt-muted">Time scale</div>
            <div className="text-mdt-text tabular-nums">{sim.config.timeScale.toFixed(2)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-mdt-muted">Actor rects</div>
            <div className="text-mdt-text tabular-nums">{sim.actorRects.length}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
