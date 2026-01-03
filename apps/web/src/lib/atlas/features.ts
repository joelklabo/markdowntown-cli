import { z } from 'zod';
import { AtlasPlatformIdSchema } from './schema.ts';
import type { AtlasPlatformId } from './types.ts';

export const ATLAS_FEATURES = [
  { id: 'repo-instructions', label: 'Repo instructions' },
  { id: 'path-scoping', label: 'Path scoping' },
  { id: 'imports', label: 'Imports / includes' },
] as const;

export type AtlasFeature = (typeof ATLAS_FEATURES)[number];

export type AtlasFeatureId = AtlasFeature['id'];

const ATLAS_FEATURE_ID_SET: ReadonlySet<string> = new Set(ATLAS_FEATURES.map(feature => feature.id));

export function isAtlasFeatureId(value: string): value is AtlasFeatureId {
  return ATLAS_FEATURE_ID_SET.has(value);
}

const ATLAS_CROSSWALK_SCHEMA_VERSION = 1 as const;

export type AtlasCrosswalkSchemaVersion = typeof ATLAS_CROSSWALK_SCHEMA_VERSION;

export type AtlasCrosswalk = {
  schemaVersion: AtlasCrosswalkSchemaVersion;
  crosswalk: Record<AtlasFeatureId, Partial<Record<AtlasPlatformId, string[]>>>;
};

const AtlasFeatureIdKeySchema = z.string().refine(isAtlasFeatureId, {
  message: 'Unknown Atlas feature id',
});

const AtlasPlatformIdKeySchema = z.string().refine(
  (value): value is AtlasPlatformId => AtlasPlatformIdSchema.safeParse(value).success,
  { message: 'Unknown Atlas platform id' },
);

const AtlasCrosswalkSchema: z.ZodType<AtlasCrosswalk> = z
  .object({
    schemaVersion: z.literal(ATLAS_CROSSWALK_SCHEMA_VERSION),
    crosswalk: z.record(
      AtlasFeatureIdKeySchema,
      z.record(AtlasPlatformIdKeySchema, z.array(z.string().min(1)).min(1)),
    ),
  })
  .transform(value => value as AtlasCrosswalk);

export function parseAtlasCrosswalk(input: unknown): AtlasCrosswalk {
  return AtlasCrosswalkSchema.parse(input);
}
