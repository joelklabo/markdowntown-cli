import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { loadAtlasSources } from "../../src/lib/atlas/sources.ts";
import { ATLAS_FEATURES, type AtlasFeatureId } from "../../src/lib/atlas/features.ts";
import { parsePlatformFacts } from "../../src/lib/atlas/schema.ts";
import type { Claim, FeatureSupportLevel, PlatformFacts } from "../../src/lib/atlas/types.ts";
import { getExtractor } from "./extractors/index.ts";

type ExtractFactsResult = {
  updatedPlatforms: string[];
};

function latestSnapshotHtml(atlasDir: string, sourceId: string): { filePath: string; html: string } {
  const dir = path.join(atlasDir, "snapshots", sourceId);
  if (!fs.existsSync(dir)) {
    throw new Error(`Missing snapshots directory: ${dir}`);
  }
  const htmlFiles = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".html"))
    .sort();
  if (htmlFiles.length === 0) {
    throw new Error(`No snapshots found for ${sourceId} in ${dir}`);
  }
  const latest = htmlFiles[htmlFiles.length - 1];
  const filePath = path.join(dir, latest);
  return { filePath, html: fs.readFileSync(filePath, "utf8") };
}

function ensureExpectedPhrases(sourceId: string, snapshotPath: string, html: string, phrases: string[]) {
  const missing = phrases.filter((p) => !html.includes(p));
  if (missing.length > 0) {
    const list = missing.map((p) => `- ${p}`).join("\n");
    throw new Error(
      `[atlas:extract] Missing expected phrases for ${sourceId} in ${snapshotPath}\n${list}`
    );
  }
}

function mergeClaims(existing: Claim[], incoming: Claim[]): Claim[] {
  const byId = new Map<string, Claim>();
  for (const claim of existing) byId.set(claim.id, claim);
  for (const claim of incoming) byId.set(claim.id, claim);
  return Array.from(byId.values());
}

function mergeFeatureSupport(
  existing: Record<string, FeatureSupportLevel>,
  delta: Partial<Record<AtlasFeatureId, FeatureSupportLevel>>
): Record<string, FeatureSupportLevel> {
  return { ...existing, ...delta };
}

function loadOrInitFacts(
  factsPath: string,
  platformId: PlatformFacts["platformId"],
  nowIso: string
): PlatformFacts {
  if (!fs.existsSync(factsPath)) {
    const featureSupport = Object.fromEntries(
      ATLAS_FEATURES.map((f) => [f.id, "no" as const])
    ) as Record<AtlasFeatureId, FeatureSupportLevel>;

    return parsePlatformFacts({
      schemaVersion: 1,
      platformId,
      name: platformId,
      retrievedAt: nowIso,
      lastVerified: nowIso,
      artifacts: [],
      claims: [],
      featureSupport,
    });
  }

  return parsePlatformFacts(JSON.parse(fs.readFileSync(factsPath, "utf8")) as unknown);
}

export async function extractAtlasFacts(options?: { atlasDir?: string; now?: () => Date }): Promise<ExtractFactsResult> {
  const atlasDir = options?.atlasDir ?? path.join(process.cwd(), "atlas");
  const nowIso = (options?.now ?? (() => new Date()))().toISOString();

  const sourcesFile = loadAtlasSources({ atlasDir });
  const updates = new Map<PlatformFacts["platformId"], PlatformFacts>();

  for (const source of sourcesFile.sources) {
    const { filePath: snapshotPath, html } = latestSnapshotHtml(atlasDir, source.id);
    ensureExpectedPhrases(source.id, snapshotPath, html, source.expectedPhrases);

    const extractor = getExtractor(source.id);
    const extracted = await extractor.extract({ source, html });

    const factsDir = path.join(atlasDir, "facts");
    fs.mkdirSync(factsDir, { recursive: true });
    const factsPath = path.join(factsDir, `${source.platformId}.json`);

    const base = updates.get(source.platformId) ?? loadOrInitFacts(factsPath, source.platformId, nowIso);
    const merged: PlatformFacts = {
      ...base,
      claims: mergeClaims(base.claims, extracted.claims),
      featureSupport: mergeFeatureSupport(base.featureSupport, extracted.featureSupport),
    };
    updates.set(source.platformId, merged);
  }

  for (const [platformId, facts] of updates) {
    const next: PlatformFacts = { ...facts, lastVerified: nowIso };
    const factsPath = path.join(atlasDir, "facts", `${platformId}.json`);
    fs.writeFileSync(factsPath, JSON.stringify(next, null, 2), "utf8");
  }

  return { updatedPlatforms: Array.from(updates.keys()) };
}

async function main() {
  try {
    const result = await extractAtlasFacts();
    console.log(`[atlas:extract] Updated facts: ${result.updatedPlatforms.join(", ") || "(none)"}`);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(`[atlas:extract] Facts schema validation failed\n${error.message}`);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  void main();
}

