'use client';

import type { ReactElement } from "react";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { clamp01 } from "./sim/easing";
import type { CityWordmarkActorRect } from "./sim/actors/types";
import { createCityWordmarkLayout, createCityWordmarkSkylineMask } from "./sim/layout";
import { getCityWordmarkPalette } from "./sim/palette";
import { getCelestialPositions, getTimeOfDayPhase } from "./sim/time";
import type { Rgb } from "./sim/color";
import { lerpRgb } from "./sim/color";
import { batchVoxelRectsToPaths, normalizeVoxelScale, rgbToCss, voxelRectsToPath } from "./sim/renderSvg";
import { createCityWordmarkWindows, getCityWordmarkWindowLights } from "./sim/windowLights";
import type { CityWordmarkRenderDetail, CityWordmarkScheme, CityWordmarkSkylineConfig } from "./sim/types";

type LivingCityWordmarkSvgProps = {
  titleId: string;
  descId: string;
  className?: string;
  seed?: string;
  /** Normalized time-of-day (0..1). */
  timeOfDay?: number;
  scheme?: CityWordmarkScheme;
  nowMs?: number;
  actorRects?: readonly CityWordmarkActorRect[];
  /** Resolution multiplier (higher = smaller voxels). */
  voxelScale?: number;
  /** Render detail preset for HD assets. */
  renderDetail?: CityWordmarkRenderDetail;
  /** Multiplier for extra skyline width in voxels. */
  bannerScale?: number;
  /** Force width/height to follow CSS sizing. */
  sizeMode?: "fixed" | "fluid";
  preserveAspectRatio?: string;
  skyline?: Partial<CityWordmarkSkylineConfig>;
  /** Force solid fills instead of grid patterns for deterministic snapshots. */
  forceSolidGrid?: boolean;
};

const ACCESSIBLE_TITLE = "mark downtown";
const VISUAL_WORD = "MARKDOWNTOWN";
const SIREN_RED: Rgb = [223, 42, 72];
const SIREN_BLUE: Rgb = [34, 186, 241];
const BASE_VOXEL_PIXEL_SCALE = 3;

function logWordmarkError(scope: string, error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[wordmark:${scope}]`, error, context ?? {});
}

function renderCelestialBodyRects(
  x: number,
  y: number,
  size: number,
  kind: "sun" | "moon",
  detailScale: number
): Array<ReactElement> {
  const isHd = detailScale > 1;
  const ray = Math.max(1, Math.floor(size / 3));
  const rayOffset = Math.max(0, Math.floor((size - ray) / 2));
  const diag = Math.max(1, Math.floor(ray / 2));
  if (kind === "sun") {
    const coreInset = Math.max(1, Math.floor(size / 4));
    const coreSize = Math.max(1, size - coreInset * 2);
    const rays = [
      <rect key="sun-ray-left" x={x - ray} y={y + rayOffset} width={ray} height={ray} />,
      <rect key="sun-ray-right" x={x + size} y={y + rayOffset} width={ray} height={ray} />,
    ];
    if (isHd) {
      rays.push(
        <rect key="sun-ray-top" x={x + rayOffset} y={y - ray} width={ray} height={ray} />,
        <rect key="sun-ray-bottom" x={x + rayOffset} y={y + size} width={ray} height={ray} />,
        <rect key="sun-ray-tl" x={x - diag} y={y - diag} width={diag} height={diag} opacity={0.8} />,
        <rect key="sun-ray-tr" x={x + size} y={y - diag} width={diag} height={diag} opacity={0.8} />,
        <rect key="sun-ray-bl" x={x - diag} y={y + size} width={diag} height={diag} opacity={0.8} />,
        <rect key="sun-ray-br" x={x + size} y={y + size} width={diag} height={diag} opacity={0.8} />,
        <rect
          key="sun-core-inner"
          x={x + coreInset}
          y={y + coreInset}
          width={coreSize}
          height={coreSize}
          opacity={0.35}
        />
      );
    }

    return [
      <rect key="sun-core" x={x} y={y} width={size} height={size} rx={Math.max(1, size / 3)} ry={Math.max(1, size / 3)} />,
      ...rays,
    ];
  }

  const cutSize = Math.max(1, Math.floor(size * 0.6));
  const cutX = x + Math.floor(size * 0.4);
  const cutY = y + Math.floor(size * 0.2);
  const crater = Math.max(1, Math.floor(size / 5));
  const craterSmall = Math.max(1, Math.floor(size / 7));

  return [
    <rect key="moon-core" x={x} y={y} width={size} height={size} rx={Math.max(1, size / 3)} ry={Math.max(1, size / 3)} />,
    <rect key="moon-cut" x={cutX} y={cutY} width={cutSize} height={cutSize} opacity={0.35} />,
    isHd ? (
      <rect key="moon-crater-1" x={x + crater} y={y + crater} width={crater} height={crater} opacity={0.25} />
    ) : null,
    isHd ? (
      <rect
        key="moon-crater-2"
        x={x + Math.floor(size * 0.65)}
        y={y + Math.floor(size * 0.55)}
        width={crater}
        height={crater}
        opacity={0.2}
      />
    ) : null,
    isHd ? (
      <rect
        key="moon-crater-3"
        x={x + Math.floor(size * 0.2)}
        y={y + Math.floor(size * 0.65)}
        width={craterSmall}
        height={craterSmall}
        opacity={0.2}
      />
    ) : null,
    isHd ? (
      <rect
        key="moon-crater-4"
        x={x + Math.floor(size * 0.55)}
        y={y + Math.floor(size * 0.25)}
        width={craterSmall}
        height={craterSmall}
        opacity={0.18}
      />
    ) : null,
  ].filter(Boolean) as Array<ReactElement>;
}

export function LivingCityWordmarkSvg({
  titleId,
  descId,
  className,
  seed = "markdowntown",
  timeOfDay = 0.78,
  scheme = "classic",
  nowMs = 0,
  actorRects = [],
  voxelScale: voxelScaleProp,
  renderDetail,
  bannerScale: bannerScaleProp,
  sizeMode = "fixed",
  preserveAspectRatio,
  skyline: skylineOverrides,
  forceSolidGrid = false,
}: LivingCityWordmarkSvgProps) {
  const detail = renderDetail ?? "hd";
  const resolution = normalizeVoxelScale(voxelScaleProp ?? BASE_VOXEL_PIXEL_SCALE);
  const bannerScale = normalizeVoxelScale(bannerScaleProp ?? 1);
  const layout = useMemo(() => {
    try {
      return createCityWordmarkLayout({ resolution, sceneScale: bannerScale, detail });
    } catch (error) {
      logWordmarkError("layout", error, { resolution, bannerScale, detail });
      return createCityWordmarkLayout({
        resolution: BASE_VOXEL_PIXEL_SCALE,
        sceneScale: 1,
        detail: "standard",
      });
    }
  }, [detail, resolution, bannerScale]);

  const palette = useMemo(() => getCityWordmarkPalette(timeOfDay, scheme), [scheme, timeOfDay]);
  const useTokenPalette = scheme === "classic";
  const gridBuilding = useMemo(
    () => lerpRgb(palette.building, palette.buildingMuted, 0.2),
    [palette]
  );
  const gridBuildingMuted = useMemo(
    () => lerpRgb(palette.buildingMuted, palette.sky, 0.1),
    [palette]
  );
  const { daylight } = getTimeOfDayPhase(timeOfDay);
  const nightness = clamp01(1 - daylight);
  const celestial = getCelestialPositions(timeOfDay);

  const sceneWidth = layout.sceneWidth;
  const sceneHeight = layout.height;
  const viewWidth = sceneWidth / layout.detailScale;
  const viewHeight = sceneHeight / layout.detailScale;
  const baseWidth = viewWidth / resolution;
  const baseHeight = viewHeight / resolution;
  const pixelWidth = Math.round(baseWidth * BASE_VOXEL_PIXEL_SCALE);
  const pixelHeight = Math.round(baseHeight * BASE_VOXEL_PIXEL_SCALE);
  const gridScale = layout.gridScale;

  const topPadding = layout.topPadding;
  const skyHeight = Math.max(1, topPadding);

  const starOpacity = clamp01(nightness * 1.1);
  const stars = [
    { x: Math.round(sceneWidth * 0.18), y: 2 * resolution },
    { x: Math.round(sceneWidth * 0.34), y: 4 * resolution },
    { x: Math.round(sceneWidth * 0.62), y: 3 * resolution },
    { x: Math.round(sceneWidth * 0.78), y: 5 * resolution },
  ];

  const skyline = useMemo(() => {
    const minHeight = (skylineOverrides?.minHeight ?? 2) * gridScale;
    const maxHeight = (skylineOverrides?.maxHeight ?? 6) * gridScale;
    const options = {
      width: sceneWidth,
      baselineY: layout.baselineY,
      seed,
      minHeight,
      maxHeight,
      ...(skylineOverrides?.minSegmentWidth != null
        ? { minSegmentWidth: skylineOverrides.minSegmentWidth }
        : {}),
      ...(skylineOverrides?.maxSegmentWidth != null
        ? { maxSegmentWidth: skylineOverrides.maxSegmentWidth }
        : {}),
    };
    try {
      return createCityWordmarkSkylineMask(options);
    } catch (error) {
      logWordmarkError("skyline", error, options);
      return [];
    }
  }, [layout.baselineY, gridScale, sceneWidth, seed, skylineOverrides]);
  const skylinePath = useMemo(() => voxelRectsToPath(skyline, 1), [skyline]);

  const wordmarkPath = useMemo(() => voxelRectsToPath(layout.rects, 1), [layout.rects]);

  const windows = useMemo(() => {
    try {
      return createCityWordmarkWindows({ seed, resolution, detail });
    } catch (error) {
      logWordmarkError("windows", error, { seed, resolution, detail });
      return [];
    }
  }, [detail, resolution, seed]);
  const windowState = useMemo(
    () => getCityWordmarkWindowLights(windows, { nowMs, timeOfDay }),
    [nowMs, timeOfDay, windows]
  );
  const windowsPath = useMemo(() => {
    const lit: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let i = 0; i < windows.length; i++) {
      if (!windowState[i]) continue;
      const w = windows[i];
      if (!w) continue;
      lit.push({ x: w.x, y: w.y, width: 1, height: 1 });
    }
    return voxelRectsToPath(lit, 1);
  }, [windowState, windows]);

  const bodySize = 2 * gridScale;
  const skyMaxX = Math.max(0, sceneWidth - bodySize);
  const skyMaxY = Math.max(0, skyHeight - bodySize);

  const sunX = Math.round(skyMaxX * celestial.sun.x);
  const sunY = Math.round(skyMaxY * (1 - clamp01(celestial.sun.altitude)));
  const moonX = Math.round(skyMaxX * celestial.moon.x);
  const moonY = Math.round(skyMaxY * (1 - clamp01(celestial.moon.altitude)));

  const actorBatches = useMemo(
    () =>
      batchVoxelRectsToPaths(actorRects, {
        scale: 1,
        getGroup: (rect) => {
          let fill: Rgb;
          if (rect.tone === "headlight") fill = palette.window;
          else if (rect.tone === "car") fill = palette.car;
          else if (rect.tone === "ambulance") fill = palette.building;
          else if (rect.tone === "pedestrian") fill = palette.building;
          else if (rect.tone === "dog") fill = palette.buildingMuted;
          else if (rect.tone === "sirenRed") fill = SIREN_RED;
          else if (rect.tone === "sirenBlue") fill = SIREN_BLUE;
          else fill = palette.buildingMuted;

          const baseOpacity = rect.opacity ?? 1;
          let opacity = baseOpacity;
          if (rect.tone === "headlight") opacity *= clamp01(nightness * 1.25);
          if (rect.tone === "sirenRed" || rect.tone === "sirenBlue") opacity *= clamp01(0.65 + nightness * 0.65);
          if (!Number.isFinite(opacity) || opacity <= 0) return null;

          const fillCss = rgbToCss(fill);
          return {
            key: `${rect.tone}-${fillCss}-${opacity}`,
            meta: { fillCss, opacity },
          };
        },
      }),
    [actorRects, nightness, palette]
  );

  const useGridPatterns = gridScale > 1 && !forceSolidGrid;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      className={cn("select-none", className)}
      width={sizeMode === "fluid" ? "100%" : pixelWidth}
      height={sizeMode === "fluid" ? "100%" : pixelHeight}
      data-render-detail={detail}
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
      aria-roledescription="Animated wordmark"
      preserveAspectRatio={preserveAspectRatio}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <defs>
        {useGridPatterns && (
          <>
            <pattern
              id={`${titleId}-building-grid`}
              patternUnits="userSpaceOnUse"
              width="1"
              height="1"
            >
              <rect x={0} y={0} width={1} height={1} fill={rgbToCss(gridBuilding)} />
              <rect x={0.08} y={0.08} width={0.84} height={0.84} fill={rgbToCss(palette.building)} />
            </pattern>
            <pattern
              id={`${titleId}-building-muted-grid`}
              patternUnits="userSpaceOnUse"
              width="1"
              height="1"
            >
              <rect x={0} y={0} width={1} height={1} fill={rgbToCss(gridBuildingMuted)} />
              <rect x={0.08} y={0.08} width={0.84} height={0.84} fill={rgbToCss(palette.buildingMuted)} />
            </pattern>
          </>
        )}
      </defs>

      <title id={titleId}>{ACCESSIBLE_TITLE}</title>
      <desc id={descId}>Living voxel/cityscape wordmark spelling “{VISUAL_WORD}”.</desc>

      <g transform={layout.detailScale === 1 ? undefined : `scale(${1 / layout.detailScale})`}>
        <rect x={0} y={0} width={sceneWidth} height={sceneHeight} fill={rgbToCss(palette.sky)} />

        {celestial.sun.visible && (
          <g fill={rgbToCss(palette.sun)} opacity={clamp01(daylight * 1.1)}>
          {renderCelestialBodyRects(sunX, sunY, bodySize, "sun", gridScale)}
        </g>
      )}

        {celestial.moon.visible && (
          <g
            fill={rgbToCss(palette.moon)}
            opacity={clamp01(nightness * 1.1)}
            data-mtw={useTokenPalette ? "moon" : undefined}
          >
          {renderCelestialBodyRects(moonX, moonY, bodySize, "moon", gridScale)}
        </g>
      )}

        {stars.map((star) => {
          const twinkleDelay = ((star.x + star.y) % 10) * 0.15;
          return (
          <rect
            key={`${star.x}-${star.y}`}
            x={star.x}
            y={star.y}
            width={resolution}
            height={resolution}
            fill={rgbToCss(palette.star)}
            opacity={starOpacity}
            data-mtw-anim="twinkle"
            data-mtw={useTokenPalette ? "star" : undefined}
            style={{ animationDelay: `${twinkleDelay}s` }}
          />
          );
        })}

        <g
          fill={useGridPatterns ? `url(#${titleId}-building-muted-grid)` : rgbToCss(palette.buildingMuted)}
          opacity={0.9}
          data-mtw={useTokenPalette ? "building-muted" : undefined}
        >
          <path d={skylinePath} />
        </g>

        <g
          fill={useGridPatterns ? `url(#${titleId}-building-grid)` : rgbToCss(palette.building)}
          data-mtw={useTokenPalette ? "building" : undefined}
        >
          <path d={wordmarkPath} />
        </g>

        <rect
          x={0}
          y={layout.baselineY - resolution}
          width={sceneWidth}
          height={resolution}
          fill={rgbToCss(palette.buildingMuted)}
          opacity={0.25}
          data-mtw={useTokenPalette ? "building-muted" : undefined}
        />

        {windowsPath.length > 0 && (
          <g
            fill={rgbToCss(palette.window)}
            opacity={clamp01(nightness * 1.15)}
            data-mtw-anim="shimmer"
            data-mtw={useTokenPalette ? "window" : undefined}
          >
            <path d={windowsPath} />
          </g>
        )}

        {actorBatches.length > 0 && (
          <g>
            {actorBatches.map((batch) => (
              <path key={batch.key} d={batch.d} fill={batch.meta.fillCss} opacity={batch.meta.opacity} />
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}
