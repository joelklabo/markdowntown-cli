import { z } from "zod";
import type {
  CityWordmarkActorsConfig,
  CityWordmarkConfig,
  CityWordmarkDensity,
  CityWordmarkRenderDetail,
  CityWordmarkRenderConfig,
  CityWordmarkScheme,
  CityWordmarkSkylineConfig,
} from "./types";
import { CITY_WORDMARK_DENSITIES, CITY_WORDMARK_RENDER_DETAILS, CITY_WORDMARK_SCHEMES } from "./types";

const densitySchema = z.enum(CITY_WORDMARK_DENSITIES) satisfies z.ZodType<CityWordmarkDensity>;
const schemeSchema = z.enum(CITY_WORDMARK_SCHEMES) satisfies z.ZodType<CityWordmarkScheme>;
const renderDetailSchema = z.enum(CITY_WORDMARK_RENDER_DETAILS) satisfies z.ZodType<CityWordmarkRenderDetail>;

const defaultActors: CityWordmarkActorsConfig = {
  cars: true,
  trucks: false,
  streetlights: true,
  pedestrians: true,
  dogs: false,
  ambulance: true,
};

const defaultRender: CityWordmarkRenderConfig = {
  voxelScale: 3,
  bannerScale: 1,
  detail: "hd",
};

const defaultSkyline: CityWordmarkSkylineConfig = {
  minHeight: 2,
  maxHeight: 6,
  minSegmentWidth: 2,
  maxSegmentWidth: 6,
};

const actorsSchema = z.object({
  cars: z.boolean().default(defaultActors.cars),
  trucks: z.boolean().default(defaultActors.trucks),
  streetlights: z.boolean().default(defaultActors.streetlights),
  pedestrians: z.boolean().default(defaultActors.pedestrians),
  dogs: z.boolean().default(defaultActors.dogs),
  ambulance: z.boolean().default(defaultActors.ambulance),
});

const actorsOverridesSchema = z
  .object({
    cars: z.boolean().optional(),
    trucks: z.boolean().optional(),
    streetlights: z.boolean().optional(),
    pedestrians: z.boolean().optional(),
    dogs: z.boolean().optional(),
    ambulance: z.boolean().optional(),
  })
  .strict();

const renderSchema = z.object({
  voxelScale: z.number().int().min(1).max(32).default(defaultRender.voxelScale),
  bannerScale: z.number().int().min(1).max(32).default(defaultRender.bannerScale),
  detail: renderDetailSchema.default(defaultRender.detail),
});

const renderOverridesSchema = z
  .object({
    voxelScale: z.number().int().min(1).max(32).optional(),
    bannerScale: z.number().int().min(1).max(32).optional(),
    detail: renderDetailSchema.optional(),
  })
  .strict();

const skylineSchema = z
  .object({
    minHeight: z.number().int().min(1).max(32).default(defaultSkyline.minHeight),
    maxHeight: z.number().int().min(1).max(64).default(defaultSkyline.maxHeight),
    minSegmentWidth: z.number().int().min(1).max(64).default(defaultSkyline.minSegmentWidth),
    maxSegmentWidth: z.number().int().min(1).max(128).default(defaultSkyline.maxSegmentWidth),
  })
  .superRefine((value, ctx) => {
    if (value.maxHeight < value.minHeight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxHeight"],
        message: "skyline.maxHeight must be >= skyline.minHeight",
      });
    }
    if (value.maxSegmentWidth < value.minSegmentWidth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSegmentWidth"],
        message: "skyline.maxSegmentWidth must be >= skyline.minSegmentWidth",
      });
    }
  });

const skylineOverridesSchema = z
  .object({
    minHeight: z.number().int().min(1).max(32).optional(),
    maxHeight: z.number().int().min(1).max(64).optional(),
    minSegmentWidth: z.number().int().min(1).max(64).optional(),
    maxSegmentWidth: z.number().int().min(1).max(128).optional(),
  })
  .strict();

const configSchema = z.object({
  seed: z.string().min(1).default("markdowntown"),
  timeOfDay: z.number().min(0).max(1).default(0.78),
  timeScale: z.number().positive().default(0.85),
  density: densitySchema.default("normal"),
  scheme: schemeSchema.default("classic"),
  render: renderSchema.default(defaultRender),
  skyline: skylineSchema.default(defaultSkyline),
  actors: actorsSchema.default(defaultActors),
});

const configOverridesSchema = z.object({
  seed: z.string().min(1).optional(),
  timeOfDay: z.number().min(0).max(1).optional(),
  timeScale: z.number().positive().optional(),
  density: densitySchema.optional(),
  scheme: schemeSchema.optional(),
  render: renderOverridesSchema.optional(),
  skyline: skylineOverridesSchema.optional(),
  actors: actorsOverridesSchema.optional(),
});

export type CityWordmarkConfigInput = z.input<typeof configSchema>;

export function getDefaultCityWordmarkConfig(): CityWordmarkConfig {
  return configSchema.parse({});
}

export function mergeCityWordmarkConfig(base: CityWordmarkConfig, overrides: unknown): CityWordmarkConfig {
  if (overrides == null) return base;
  const parsedOverrides = configOverridesSchema.parse(overrides);
  return configSchema.parse({
    ...base,
    ...parsedOverrides,
    render: {
      ...base.render,
      ...(parsedOverrides.render ?? {}),
    },
    skyline: {
      ...base.skyline,
      ...(parsedOverrides.skyline ?? {}),
    },
    actors: {
      ...base.actors,
      ...(parsedOverrides.actors ?? {}),
    },
  });
}
