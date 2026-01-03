import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  listAtlasPlatforms,
  loadAtlasFacts,
  listAtlasGuideSlugs,
  loadAtlasGuideMdx,
  type AtlasGuideKind,
} from "../../src/lib/atlas/load.ts";

export type AtlasSearchItemKind = "platform" | "artifact" | "claim" | "guide" | "example";

export type AtlasSearchItem = {
  id: string;
  kind: AtlasSearchItemKind;
  title: string;
  platformId?: string;
  artifactKind?: string;
  claimId?: string;
  guideKind?: AtlasGuideKind;
  slug?: string;
  fileName?: string;
  filePath: string;
  paths?: string[];
};

export type AtlasSearchIndex = {
  schemaVersion: 1;
  generatedAt: string;
  items: AtlasSearchItem[];
};

export type GenerateAtlasIndexResult = {
  index: AtlasSearchIndex;
  outFile: string;
};

type GenerateAtlasIndexOptions = {
  atlasDir?: string;
  outFile?: string;
  now?: () => Date;
};

function defaultOutFile(): string {
  return path.join(process.cwd(), "src", "lib", "atlas", "index.generated.json");
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function extractFirstHeading(source: string): string | null {
  const lines = source.split(/\r?\n/);
  for (const line of lines) {
    const match = /^\s*#\s+(.+?)\s*$/.exec(line);
    if (match) return match[1].trim();
  }
  return null;
}

function listExampleFiles(atlasDir: string, platformId: string): string[] {
  const examplesDir = path.join(atlasDir, "examples", platformId);
  if (!fs.existsSync(examplesDir)) return [];

  const entries = fs.readdirSync(examplesDir);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const full = path.join(examplesDir, entry);
    if (!fs.statSync(full).isFile()) continue;
    files.push(entry);
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function sortItems(items: AtlasSearchItem[]): AtlasSearchItem[] {
  const kindOrder: Record<AtlasSearchItemKind, number> = {
    platform: 0,
    guide: 1,
    example: 2,
    artifact: 3,
    claim: 4,
  };

  return items.sort((a, b) => {
    const byKind = kindOrder[a.kind] - kindOrder[b.kind];
    if (byKind !== 0) return byKind;
    return a.id.localeCompare(b.id);
  });
}

export function generateAtlasSearchIndex(options?: GenerateAtlasIndexOptions): GenerateAtlasIndexResult {
  const atlasDir = options?.atlasDir ?? path.join(process.cwd(), "atlas");
  const outFile = options?.outFile ?? defaultOutFile();
  const nowIso = (options?.now ?? (() => new Date()))().toISOString();

  const items: AtlasSearchItem[] = [];

  const platformIds = listAtlasPlatforms({ atlasDir });
  for (const platformId of platformIds) {
    const facts = loadAtlasFacts(platformId, { atlasDir });
    const factsPath = path.join("atlas", "facts", `${platformId}.json`);

    items.push({
      id: `platform:${platformId}`,
      kind: "platform",
      title: facts.name,
      platformId,
      filePath: factsPath,
    });

    const artifacts = [...facts.artifacts].sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
    for (const artifact of artifacts) {
      items.push({
        id: `artifact:${platformId}:${artifact.kind}`,
        kind: "artifact",
        title: artifact.label,
        platformId,
        artifactKind: artifact.kind,
        filePath: factsPath,
        paths: [...artifact.paths].sort((a, b) => a.localeCompare(b)),
      });
    }

    const claims = [...facts.claims].sort((a, b) => a.id.localeCompare(b.id));
    for (const claim of claims) {
      items.push({
        id: `claim:${platformId}:${claim.id}`,
        kind: "claim",
        title: claim.statement,
        platformId,
        claimId: claim.id,
        filePath: factsPath,
      });
    }

    const examples = listExampleFiles(atlasDir, platformId);
    for (const fileName of examples) {
      items.push({
        id: `example:${platformId}:${fileName}`,
        kind: "example",
        title: fileName,
        platformId,
        fileName,
        filePath: path.join("atlas", "examples", platformId, fileName),
      });
    }
  }

  const guideKinds: AtlasGuideKind[] = ["concepts", "recipes"];
  for (const kind of guideKinds) {
    const slugs = listAtlasGuideSlugs(kind, { atlasDir });
    for (const slug of slugs) {
      const guidePath = `${kind}/${slug}`;
      const mdx = loadAtlasGuideMdx(guidePath, { atlasDir });
      const title = extractFirstHeading(mdx) ?? slug;
      items.push({
        id: `guide:${kind}:${slug}`,
        kind: "guide",
        title,
        guideKind: kind,
        slug,
        filePath: path.join("atlas", "guides", kind, `${slug}.mdx`),
      });
    }
  }

  sortItems(items);

  const index: AtlasSearchIndex = {
    schemaVersion: 1,
    generatedAt: nowIso,
    items,
  };

  writeJson(outFile, index);
  return { index, outFile };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const result = generateAtlasSearchIndex();
  console.log(`[atlas:generate-index] Wrote ${result.index.items.length} items to ${result.outFile}`);
}
