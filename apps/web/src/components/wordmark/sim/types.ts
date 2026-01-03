export const CITY_WORDMARK_DENSITIES = ["sparse", "normal", "dense"] as const;
export type CityWordmarkDensity = (typeof CITY_WORDMARK_DENSITIES)[number];

export const CITY_WORDMARK_SCHEMES = ["classic", "noir", "neon"] as const;
export type CityWordmarkScheme = (typeof CITY_WORDMARK_SCHEMES)[number];

export const CITY_WORDMARK_RENDER_DETAILS = ["standard", "hd"] as const;
export type CityWordmarkRenderDetail = (typeof CITY_WORDMARK_RENDER_DETAILS)[number];

export type CityWordmarkRenderConfig = {
  /** Resolution multiplier for the full scene (higher = smaller voxels). */
  voxelScale: number;
  /** Multiplier for full-width banner rendering. */
  bannerScale: number;
  /** Detail preset for choosing standard vs HD assets. */
  detail: CityWordmarkRenderDetail;
};

export type CityWordmarkSkylineConfig = {
  minHeight: number;
  maxHeight: number;
  minSegmentWidth: number;
  maxSegmentWidth: number;
};

export type CityWordmarkActorsConfig = {
  cars: boolean;
  trucks: boolean;
  streetlights: boolean;
  pedestrians: boolean;
  dogs: boolean;
  ambulance: boolean;
};

/**
 * Normalized time-of-day value.
 * - 0.00 = midnight
 * - 0.25 = sunrise-ish
 * - 0.50 = noon
 * - 0.75 = sunset-ish
 */
export type CityWordmarkTimeOfDay = number;

export type CityWordmarkConfig = {
  /** Seed for deterministic randomness and stable visual baselines. */
  seed: string;
  /** Normalized time-of-day (0..1). */
  timeOfDay: CityWordmarkTimeOfDay;
  /** Simulation speed multiplier (1 = real-time-ish). */
  timeScale: number;
  /** Density preset used for actor spawn rates, window density, etc. */
  density: CityWordmarkDensity;
  /** Curated color scheme preset. */
  scheme: CityWordmarkScheme;
  /** Render tuning knobs (scale, etc). */
  render: CityWordmarkRenderConfig;
  /** Skyline silhouette tuning. */
  skyline: CityWordmarkSkylineConfig;
  /** Actor toggles. */
  actors: CityWordmarkActorsConfig;
};

export type CityWordmarkEventBase = {
  /** Event timestamp in ms since epoch. */
  ts?: number;
};

export type CityWordmarkEvent =
  | ({ type: "search"; query: string } & CityWordmarkEventBase)
  | ({ type: "command_palette_open"; origin?: string } & CityWordmarkEventBase)
  | ({ type: "publish"; kind?: "artifact" | "template" | "snippet" | "file" } & CityWordmarkEventBase)
  | ({ type: "upload"; kind?: "artifact" | "template" | "snippet" | "file" } & CityWordmarkEventBase)
  | ({ type: "login"; method?: "oauth" | "password" | "sso" } & CityWordmarkEventBase)
  | ({ type: "alert"; kind: "ambulance" } & CityWordmarkEventBase);

const _CITY_WORDMARK_EVENT_TYPES = [
  "search",
  "command_palette_open",
  "publish",
  "upload",
  "login",
  "alert",
] as const;

export type CityWordmarkEventType = (typeof _CITY_WORDMARK_EVENT_TYPES)[number];

const eventBaseSchema = z.object({
  ts: z.number().finite().optional(),
});

const eventKindSchema = z.enum(["artifact", "template", "snippet", "file"]);

const cityWordmarkEventSchema = z.discriminatedUnion("type", [
  eventBaseSchema.extend({
    type: z.literal("search"),
    query: z.string().min(1),
  }),
  eventBaseSchema.extend({
    type: z.literal("command_palette_open"),
    origin: z.string().optional(),
  }),
  eventBaseSchema.extend({
    type: z.literal("publish"),
    kind: eventKindSchema.optional(),
  }),
  eventBaseSchema.extend({
    type: z.literal("upload"),
    kind: eventKindSchema.optional(),
  }),
  eventBaseSchema.extend({
    type: z.literal("login"),
    method: z.enum(["oauth", "password", "sso"]).optional(),
  }),
  eventBaseSchema.extend({
    type: z.literal("alert"),
    kind: z.literal("ambulance"),
  }),
]);

export function parseCityWordmarkEvent(value: unknown): CityWordmarkEvent | null {
  const parsed = cityWordmarkEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
import { z } from "zod";
