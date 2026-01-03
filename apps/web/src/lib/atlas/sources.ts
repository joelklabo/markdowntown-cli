import fs from "node:fs";
import path from "node:path";
import { ZodError, z } from "zod";
import { parse as parseYaml } from "yaml";
import { AtlasPlatformIdSchema } from "./schema.ts";

const ATLAS_SOURCES_SCHEMA_VERSION = 1 as const;

export type AtlasSourcesSchemaVersion = typeof ATLAS_SOURCES_SCHEMA_VERSION;

const AtlasSourceKindSchema = z.enum(["docs", "repo", "blog", "spec", "example", "other"]);
export type AtlasSourceKind = z.infer<typeof AtlasSourceKindSchema>;

const AtlasSourceCadenceSchema = z.enum(["daily", "weekly", "monthly", "quarterly", "ad-hoc"]);
export type AtlasSourceCadence = z.infer<typeof AtlasSourceCadenceSchema>;

const AtlasSourceTrustSchema = z.enum(["official", "high", "medium", "low"]);
export type AtlasSourceTrust = z.infer<typeof AtlasSourceTrustSchema>;

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const at = issue.path.length ? issue.path.join(".") : "(root)";
      return `${at}: ${issue.message}`;
    })
    .join("\n");
}

const AtlasSourceSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/i, { message: "id must be a stable kebab-case identifier" }),
    platformId: AtlasPlatformIdSchema,
    kind: AtlasSourceKindSchema,
    url: z
      .string()
      .url()
      .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
        message: "url must use http(s)",
      }),
    cadence: AtlasSourceCadenceSchema,
    expectedPhrases: z.array(z.string().min(1)).default(() => []),
    trust: AtlasSourceTrustSchema,
  })
  .transform((value) => ({
    ...value,
    expectedPhrases: Array.from(new Set(value.expectedPhrases.map((p) => p.trim()).filter(Boolean))),
  }));

export type AtlasSource = z.infer<typeof AtlasSourceSchema>;

const AtlasSourcesFileSchema = z.object({
  schemaVersion: z.literal(ATLAS_SOURCES_SCHEMA_VERSION),
  sources: z.array(AtlasSourceSchema).default(() => []),
});

export type AtlasSourcesFile = z.infer<typeof AtlasSourcesFileSchema>;

function parseAtlasSourcesFile(input: unknown): AtlasSourcesFile {
  return AtlasSourcesFileSchema.parse(input);
}

export function parseAtlasSourcesYaml(yamlText: string): AtlasSourcesFile {
  return parseAtlasSourcesFile(parseYaml(yamlText) as unknown);
}

export function loadAtlasSources(options?: { atlasDir?: string }): AtlasSourcesFile {
  const atlasDir = options?.atlasDir ?? path.join(process.cwd(), "atlas");
  const sourcesPath = path.join(atlasDir, "sources.yml");

  let text = "";
  try {
    text = fs.readFileSync(sourcesPath, "utf8");
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`[atlas] Failed to read sources registry: ${sourcesPath}\n${cause}`);
  }

  try {
    return parseAtlasSourcesYaml(text);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`[atlas] Invalid sources registry at ${sourcesPath}\n${formatZodError(error)}`);
    }
    throw error;
  }
}
