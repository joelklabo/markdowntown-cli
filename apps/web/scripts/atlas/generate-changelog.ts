import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { parsePlatformFacts } from "../../src/lib/atlas/schema.ts";
import type { AtlasPlatformId, PlatformFacts } from "../../src/lib/atlas/types.ts";
import type { ConfidenceChange, FactsSnapshot, FeatureSupportChange } from "./diffFacts.ts";
import { diffPlatformFacts } from "./diffFacts.ts";

export type AtlasChangelogDiff = {
  platformId: AtlasPlatformId;
  before: FactsSnapshot | null;
  after: FactsSnapshot | null;
};

export type AtlasImpactedClaim = {
  platformId: AtlasPlatformId;
  claimId: string;
};

export type AtlasChangelogEntry = {
  id: string;
  date: string;
  summary: string;
  diffs: AtlasChangelogDiff[];
  impactedClaims: AtlasImpactedClaim[];
};

export type AtlasChangelogFile = {
  lastUpdated: string;
  entries: AtlasChangelogEntry[];
};

export type GenerateChangelogResult = {
  entries: AtlasChangelogEntry[];
  markdownSummary: string;
  writtenPaths: string[];
};

type GenerateChangelogOptions = {
  atlasDir?: string;
  beforeFactsDir?: string;
  gitRef?: string;
  now?: () => Date;
};

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const at = issue.path.length ? issue.path.join(".") : "(root)";
      return `${at}: ${issue.message}`;
    })
    .join("\n");
}

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function tryReadGitFile(ref: string, repoRelativePath: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${repoRelativePath}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function safeParseFactsJson(filePath: string, jsonText: string): PlatformFacts {
  try {
    return parsePlatformFacts(JSON.parse(jsonText) as unknown);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`[atlas:changelog] Invalid facts at ${filePath}\n${formatZodError(error)}`);
    }
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`[atlas:changelog] Failed to parse facts at ${filePath}\n${cause}`);
  }
}

function listFactsPlatforms(factsDir: string): AtlasPlatformId[] {
  if (!fs.existsSync(factsDir)) return [];
  const fileNames = fs.readdirSync(factsDir).filter((name) => name.endsWith(".json"));
  const platforms = fileNames.map((name) => path.basename(name, ".json")) as AtlasPlatformId[];
  platforms.sort();
  return platforms;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function toDateSlug(dateIso: string): string {
  return dateIso.slice(0, 10);
}

function buildSummary(platformId: AtlasPlatformId, diff: ReturnType<typeof diffPlatformFacts>): string {
  const parts: string[] = [];
  if (diff.addedClaimIds.length > 0) parts.push(`+${diff.addedClaimIds.length}`);
  if (diff.changedClaimIds.length > 0) parts.push(`~${diff.changedClaimIds.length}`);
  if (diff.removedClaimIds.length > 0) parts.push(`-${diff.removedClaimIds.length}`);
  const suffix = parts.length > 0 ? ` (${parts.join(" ")})` : "";
  return `${platformId} facts updated${suffix}`;
}

function buildImpactedClaims(platformId: AtlasPlatformId, diff: ReturnType<typeof diffPlatformFacts>): AtlasImpactedClaim[] {
  const ids = new Set<string>([...diff.addedClaimIds, ...diff.changedClaimIds, ...diff.removedClaimIds]);
  return Array.from(ids)
    .sort()
    .map((claimId) => ({ platformId, claimId }));
}

function loadExistingChangelog(changelogPath: string): AtlasChangelogFile | null {
  if (!fs.existsSync(changelogPath)) return null;
  const raw = JSON.parse(readUtf8(changelogPath)) as unknown;
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<AtlasChangelogFile>;
  if (!Array.isArray(data.entries)) return null;
  const lastUpdated = typeof data.lastUpdated === "string" ? data.lastUpdated : new Date(0).toISOString();
  return { lastUpdated, entries: data.entries as AtlasChangelogEntry[] };
}

function mergeEntries(existing: AtlasChangelogEntry[], incoming: AtlasChangelogEntry[]): AtlasChangelogEntry[] {
  const byId = new Map<string, AtlasChangelogEntry>();
  for (const entry of existing) byId.set(entry.id, entry);
  for (const entry of incoming) byId.set(entry.id, entry);
  const merged = Array.from(byId.values());
  merged.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return merged;
}

export function renderPrSummary(entries: AtlasChangelogEntry[], writtenPaths: string[]): string {
  const uniquePaths = Array.from(new Set(writtenPaths));
  const lines: string[] = [];
  lines.push("### Atlas changelog");
  lines.push("");
  lines.push("**Paths**");
  for (const filePath of uniquePaths.sort()) {
    lines.push(`- \`${filePath}\``);
  }
  lines.push("");

  const diffSnapshots = (before: FactsSnapshot | null, after: FactsSnapshot | null) => {
    const beforeClaims = before?.claims ?? {};
    const afterClaims = after?.claims ?? {};
    const beforeIds = new Set(Object.keys(beforeClaims));
    const afterIds = new Set(Object.keys(afterClaims));

    const added = Array.from(afterIds)
      .filter((id) => !beforeIds.has(id))
      .sort();
    const removed = Array.from(beforeIds)
      .filter((id) => !afterIds.has(id))
      .sort();

    const shared = Array.from(new Set([...Array.from(beforeIds), ...Array.from(afterIds)])).sort();
    const changed: string[] = [];
    const confidenceChanges: ConfidenceChange[] = [];

    for (const id of shared) {
      const a = beforeClaims[id];
      const b = afterClaims[id];
      if (!a || !b) continue;
      const beforeFp = JSON.stringify(a);
      const afterFp = JSON.stringify(b);
      if (beforeFp !== afterFp) changed.push(id);
      if (a.confidence !== b.confidence) {
        confidenceChanges.push({ claimId: id, before: a.confidence, after: b.confidence });
      }
    }

    const beforeSupport = before?.featureSupport ?? {};
    const afterSupport = after?.featureSupport ?? {};
    const supportKeys = new Set([...Object.keys(beforeSupport), ...Object.keys(afterSupport)]);
    const featureSupportChanges: FeatureSupportChange[] = [];
    for (const featureId of Array.from(supportKeys).sort()) {
      const beforeValue = beforeSupport[featureId];
      const afterValue = afterSupport[featureId];
      if (beforeValue !== afterValue) featureSupportChanges.push({ featureId, before: beforeValue, after: afterValue });
    }

    return { added, removed, changed, confidenceChanges, featureSupportChanges };
  };

  for (const entry of entries) {
    const diff = entry.diffs[0];
    const platformId = diff?.platformId ?? "unknown";
    const snapshotSummary = diffSnapshots(diff?.before ?? null, diff?.after ?? null);
    lines.push(`**${platformId}**`);
    lines.push(`- Entry: \`${entry.id}\``);
    lines.push(`- Summary: ${entry.summary}`);

    if (snapshotSummary.added.length > 0) lines.push(`- Added claims: ${snapshotSummary.added.map((id) => `\`${id}\``).join(", ")}`);
    if (snapshotSummary.changed.length > 0) lines.push(`- Updated claims: ${snapshotSummary.changed.map((id) => `\`${id}\``).join(", ")}`);
    if (snapshotSummary.removed.length > 0) lines.push(`- Removed claims: ${snapshotSummary.removed.map((id) => `\`${id}\``).join(", ")}`);

    if (snapshotSummary.confidenceChanges.length > 0) {
      lines.push(`- Confidence changes: ${snapshotSummary.confidenceChanges.map((change) => `\`${change.claimId}\` ${change.before} → ${change.after}`).join(", ")}`);
    }

    if (snapshotSummary.featureSupportChanges.length > 0) {
      lines.push(
        `- Feature support: ${snapshotSummary.featureSupportChanges
          .map((change) => `\`${change.featureId}\` ${change.before ?? "unset"} → ${change.after ?? "unset"}`)
          .join(", ")}`,
      );
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export async function generateAtlasChangelog(options?: GenerateChangelogOptions): Promise<GenerateChangelogResult> {
  const atlasDir = options?.atlasDir ?? path.join(process.cwd(), "atlas");
  const factsDir = path.join(atlasDir, "facts");
  const beforeFactsDir = options?.beforeFactsDir ?? null;
  const gitRef = options?.gitRef ?? "HEAD";
  const now = (options?.now ?? (() => new Date()))();
  const nowIso = now.toISOString();
  const dateSlug = toDateSlug(nowIso);

  const platforms = listFactsPlatforms(factsDir);
  if (platforms.length === 0) {
    return { entries: [], markdownSummary: "", writtenPaths: [] };
  }

  const entryDir = path.join(atlasDir, "changelog");
  ensureDir(entryDir);

  const entries: AtlasChangelogEntry[] = [];
  const writtenPaths: string[] = [];

  for (const platformId of platforms) {
    const factsPath = path.join(factsDir, `${platformId}.json`);
    const afterText = readUtf8(factsPath);
    const afterFacts = safeParseFactsJson(factsPath, afterText);

    let beforeFacts: PlatformFacts | null = null;
    if (beforeFactsDir) {
      const beforePath = path.join(beforeFactsDir, `${platformId}.json`);
      if (fs.existsSync(beforePath)) {
        beforeFacts = safeParseFactsJson(beforePath, readUtf8(beforePath));
      }
    } else {
      const repoRelative = path.posix.join("atlas", "facts", `${platformId}.json`);
      const beforeText = tryReadGitFile(gitRef, repoRelative);
      if (beforeText) {
        beforeFacts = safeParseFactsJson(repoRelative, beforeText);
      }
    }

    const diff = diffPlatformFacts(beforeFacts, afterFacts);
    if (!diff.hasChanges) continue;

    writtenPaths.push(path.relative(process.cwd(), factsPath));

    const entryId = `${dateSlug}-${platformId}`;
    const entry: AtlasChangelogEntry = {
      id: entryId,
      date: nowIso,
      summary: buildSummary(platformId, diff),
      diffs: [
        {
          platformId,
          before: diff.before,
          after: diff.after,
        },
      ],
      impactedClaims: buildImpactedClaims(platformId, diff),
    };

    const entryPath = path.join(entryDir, `${entryId}.json`);
    writeJson(entryPath, entry);
    entries.push(entry);
    writtenPaths.push(path.relative(process.cwd(), entryPath));
  }

  const changelogPath = path.join(atlasDir, "changelog.json");
  if (entries.length > 0) {
    const existing = loadExistingChangelog(changelogPath);
    const next: AtlasChangelogFile = {
      lastUpdated: nowIso,
      entries: mergeEntries(existing?.entries ?? [], entries),
    };
    writeJson(changelogPath, next);
    writtenPaths.push(path.relative(process.cwd(), changelogPath));
  }

  const markdownSummary = entries.length > 0 ? renderPrSummary(entries, writtenPaths) : "";
  return { entries, markdownSummary, writtenPaths };
}

async function main() {
  const result = await generateAtlasChangelog();
  if (result.markdownSummary) {
    console.log(result.markdownSummary.trimEnd());
  } else {
    console.log("[atlas:changelog] No claim/support changes detected.");
  }
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  void main();
}
