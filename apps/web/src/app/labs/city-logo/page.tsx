import { getDefaultCityWordmarkConfig, mergeCityWordmarkConfig } from "@/components/wordmark/sim/config";
import type { CityWordmarkConfig, CityWordmarkDensity, CityWordmarkRenderDetail, CityWordmarkScheme } from "@/components/wordmark/sim/types";
import { CITY_WORDMARK_DENSITIES, CITY_WORDMARK_RENDER_DETAILS, CITY_WORDMARK_SCHEMES } from "@/components/wordmark/sim/types";
import { CityLogoLabClientNoSSR } from "./CityLogoLabClientNoSSR";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type CityLogoPreviewWidthMode = "fixed" | "full";

function firstString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseBool(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
}

function parsePositiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed <= 0) return undefined;
  return parsed;
}

function parseIntRange(value: string | undefined, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
}

function parseSeed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 64) return undefined;
  return trimmed;
}

function parseTimeOfDay(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 0 || parsed > 1) return undefined;
  return parsed;
}

function parsePreviewWidthMode(value: string | undefined): CityLogoPreviewWidthMode | undefined {
  if (!value) return undefined;
  if (value === "fixed") return "fixed";
  if (value === "full") return "full";
  return undefined;
}

function parseDensity(value: string | undefined): CityWordmarkDensity | undefined {
  if (!value) return undefined;
  if ((CITY_WORDMARK_DENSITIES as readonly string[]).includes(value)) {
    return value as CityWordmarkDensity;
  }
  return undefined;
}

function parseScheme(value: string | undefined): CityWordmarkScheme | undefined {
  if (!value) return undefined;
  if ((CITY_WORDMARK_SCHEMES as readonly string[]).includes(value)) {
    return value as CityWordmarkScheme;
  }
  return undefined;
}

function parseRenderDetail(value: string | undefined): CityWordmarkRenderDetail | undefined {
  if (!value) return undefined;
  if ((CITY_WORDMARK_RENDER_DETAILS as readonly string[]).includes(value)) {
    return value as CityWordmarkRenderDetail;
  }
  return undefined;
}

function parseInitialConfig(searchParams: SearchParams): CityWordmarkConfig {
  const overrides: Record<string, unknown> = {};

  const seed = parseSeed(firstString(searchParams.seed));
  if (seed) overrides.seed = seed;

  const timeOfDay = parseTimeOfDay(firstString(searchParams.timeOfDay));
  if (typeof timeOfDay === "number") overrides.timeOfDay = timeOfDay;

  const timeScale = parsePositiveNumber(firstString(searchParams.timeScale));
  if (typeof timeScale === "number") overrides.timeScale = timeScale;

  const density = parseDensity(firstString(searchParams.density));
  if (density) overrides.density = density;

  const scheme = parseScheme(firstString(searchParams.scheme));
  if (scheme) overrides.scheme = scheme;

  const renderOverrides: Record<string, unknown> = {};
  const voxelScale = parseIntRange(firstString(searchParams.voxelScale), 1, 32);
  if (typeof voxelScale === "number") renderOverrides.voxelScale = voxelScale;
  const bannerScale = parseIntRange(firstString(searchParams.bannerScale), 1, 32);
  if (typeof bannerScale === "number") renderOverrides.bannerScale = bannerScale;
  const detail = parseRenderDetail(firstString(searchParams.detail));
  if (detail) renderOverrides.detail = detail;
  if (Object.keys(renderOverrides).length > 0) overrides.render = renderOverrides;

  const skylineOverrides: Record<string, number> = {};
  const skyMinH = parseIntRange(firstString(searchParams.skyMinH), 1, 32);
  if (typeof skyMinH === "number") skylineOverrides.minHeight = skyMinH;
  const skyMaxH = parseIntRange(firstString(searchParams.skyMaxH), 1, 64);
  if (typeof skyMaxH === "number") skylineOverrides.maxHeight = skyMaxH;
  const skyMinW = parseIntRange(firstString(searchParams.skyMinW), 1, 64);
  if (typeof skyMinW === "number") skylineOverrides.minSegmentWidth = skyMinW;
  const skyMaxW = parseIntRange(firstString(searchParams.skyMaxW), 1, 128);
  if (typeof skyMaxW === "number") skylineOverrides.maxSegmentWidth = skyMaxW;
  if (Object.keys(skylineOverrides).length > 0) overrides.skyline = skylineOverrides;

  const actorOverrides: Record<string, boolean> = {};
  const cars = parseBool(firstString(searchParams.aCars));
  if (typeof cars === "boolean") actorOverrides.cars = cars;
  const trucks = parseBool(firstString(searchParams.aTrucks));
  if (typeof trucks === "boolean") actorOverrides.trucks = trucks;
  const streetlights = parseBool(firstString(searchParams.aStreetlights));
  if (typeof streetlights === "boolean") actorOverrides.streetlights = streetlights;
  const pedestrians = parseBool(firstString(searchParams.aPedestrians));
  if (typeof pedestrians === "boolean") actorOverrides.pedestrians = pedestrians;
  const dogs = parseBool(firstString(searchParams.aDogs));
  if (typeof dogs === "boolean") actorOverrides.dogs = dogs;
  const ambulance = parseBool(firstString(searchParams.aAmbulance));
  if (typeof ambulance === "boolean") actorOverrides.ambulance = ambulance;
  if (Object.keys(actorOverrides).length > 0) overrides.actors = actorOverrides;

  return mergeCityWordmarkConfig(getDefaultCityWordmarkConfig(), overrides);
}

export default async function CityLogoLabPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const snapshotMode = firstString(searchParams.snapshot) === "1";
  const event = firstString(searchParams.event);
  const previewWidthMode = parsePreviewWidthMode(firstString(searchParams.previewWidth));
  const play = parseBool(firstString(searchParams.play));

  return (
    <CityLogoLabClientNoSSR
      snapshotMode={snapshotMode}
      initialConfig={parseInitialConfig(searchParams)}
      initialPreviewWidthMode={previewWidthMode}
      initialPlaying={snapshotMode ? false : play}
      initialEvent={
        event === "ambulance" ||
        event === "search" ||
        event === "publish" ||
        event === "upload" ||
        event === "login" ||
        event === "command"
          ? event
          : undefined
      }
    />
  );
}
