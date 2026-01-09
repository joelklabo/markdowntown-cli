"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { createSkyscraperLayout } from "./sim/skyscraperLayout";
import { getCityWordmarkPalette } from "./sim/palette";
import { getTimeOfDayPhase } from "./sim/time";
import { clamp01 } from "./sim/easing";
import type { Rgb } from "./sim/color";
import { rgbToCss } from "./sim/renderSvg";
import type { CityWordmarkScheme } from "./sim/types";
import { createRng } from "./sim/rng";

type SkyscraperWordmarkSvgProps = {
  titleId: string;
  descId: string;
  className?: string;
  seed?: string;
  timeOfDay?: number;
  scheme?: CityWordmarkScheme;
  text?: string;
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
};

const ACCESSIBLE_TITLE = "mark downtown";

// Star positions as percentages
const STAR_POSITIONS = [
  { x: 0.08, y: 0.15 },
  { x: 0.22, y: 0.08 },
  { x: 0.35, y: 0.18 },
  { x: 0.48, y: 0.05 },
  { x: 0.62, y: 0.12 },
  { x: 0.75, y: 0.20 },
  { x: 0.88, y: 0.10 },
  { x: 0.95, y: 0.22 },
];

export function SkyscraperWordmarkSvg({
  titleId,
  descId,
  className,
  seed = "markdowntown",
  timeOfDay = 0.78,
  scheme = "classic",
  text = "MARK DOWNTOWN",
  width = 800,
  height = 200,
}: SkyscraperWordmarkSvgProps) {
  const layout = useMemo(() => {
    return createSkyscraperLayout({
      text,
      seed,
      targetWidth: width,
      targetHeight: height,
      windowSize: 3,
      windowGap: 2,
      buildingGap: 8,
      rowsAboveText: 6,
      rowsBelowText: 3,
    });
  }, [text, seed, width, height]);

  const palette = useMemo(() => getCityWordmarkPalette(timeOfDay, scheme), [scheme, timeOfDay]);
  const { daylight } = getTimeOfDayPhase(timeOfDay);
  const nightness = clamp01(1 - daylight);

  const rng = useMemo(() => createRng(`${seed}:render`), [seed]);

  // Building colors - slightly varied for visual interest
  const buildingColors = useMemo(() => {
    const baseColor = palette.building;
    return layout.buildings.map(() => {
      const variation = (rng.nextFloat() - 0.5) * 20;
      return [
        Math.max(0, Math.min(255, baseColor[0] + variation)),
        Math.max(0, Math.min(255, baseColor[1] + variation)),
        Math.max(0, Math.min(255, baseColor[2] + variation)),
      ] as Rgb;
    });
  }, [layout.buildings, palette.building, rng]);

  // Window colors
  const litWindowColor = palette.window;
  const darkWindowColor: Rgb = [
    Math.floor(palette.building[0] * 0.7),
    Math.floor(palette.building[1] * 0.7),
    Math.floor(palette.building[2] * 0.7),
  ];

  const starOpacity = clamp01(nightness * 1.2);

  return (
    <svg
      viewBox={`0 0 ${layout.sceneWidth} ${layout.sceneHeight}`}
      className={cn("select-none", className)}
      width={width}
      height={height}
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
      aria-roledescription="Animated wordmark"
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <title id={titleId}>{ACCESSIBLE_TITLE}</title>
      <desc id={descId}>
        Nighttime cityscape with skyscraper windows spelling {text}.
      </desc>

      {/* Sky background */}
      <rect
        x={0}
        y={0}
        width={layout.sceneWidth}
        height={layout.sceneHeight}
        fill={rgbToCss(palette.sky)}
      />

      {/* Stars in the gaps between buildings */}
      {STAR_POSITIONS.map((star, i) => {
        const x = Math.floor(star.x * layout.sceneWidth);
        const y = Math.floor(star.y * layout.sceneHeight);
        const size = 2;
        return (
          <rect
            key={`star-${i}`}
            x={x}
            y={y}
            width={size}
            height={size}
            fill={rgbToCss(palette.star)}
            opacity={starOpacity * (0.5 + rng.nextFloat() * 0.5)}
          />
        );
      })}

      {/* Buildings */}
      {layout.buildings.map((building, i) => (
        <rect
          key={`building-${i}`}
          x={building.x}
          y={0}
          width={building.width - layout.skyGap}
          height={layout.sceneHeight}
          fill={rgbToCss(buildingColors[i])}
        />
      ))}

      {/* Windows */}
      {layout.windows.map((window, i) => (
        <rect
          key={`window-${i}`}
          x={window.x}
          y={window.y}
          width={window.width}
          height={window.height}
          fill={rgbToCss(window.lit ? litWindowColor : darkWindowColor)}
          opacity={window.lit ? clamp01(0.7 + nightness * 0.3) : 0.15}
        />
      ))}
    </svg>
  );
}
