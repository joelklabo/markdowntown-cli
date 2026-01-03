import fs from "node:fs";
import path from "node:path";
import { listAtlasPlatforms, loadAtlasFacts } from "@/lib/atlas/load";

function normalizeDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function tryGetChangelogUpdatedAt(atlasDir: string): string | null {
  const changelogPath = path.join(atlasDir, "changelog.json");
  if (!fs.existsSync(changelogPath)) return null;

  const raw = JSON.parse(fs.readFileSync(changelogPath, "utf8")) as unknown;
  if (!raw || typeof raw !== "object") return null;

  const asAny = raw as Record<string, unknown>;
  if (typeof asAny.lastUpdated === "string") return asAny.lastUpdated;

  const entries = asAny.entries;
  if (Array.isArray(entries) && entries.length > 0) {
    const first = entries[0] as unknown;
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).date === "string") {
      return (first as Record<string, unknown>).date as string;
    }
  }

  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as unknown;
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).date === "string") {
      return (first as Record<string, unknown>).date as string;
    }
  }

  return null;
}

function getAtlasLastUpdatedIsoDate(): string | null {
  const atlasDir = path.join(process.cwd(), "atlas");
  const changelogUpdatedAt = tryGetChangelogUpdatedAt(atlasDir);
  const fromChangelog = changelogUpdatedAt ? normalizeDate(changelogUpdatedAt) : null;
  if (fromChangelog) return fromChangelog;

  const platforms = listAtlasPlatforms();
  let latest: string | null = null;

  for (const platformId of platforms) {
    const facts = loadAtlasFacts(platformId);
    const iso = normalizeDate(facts.lastVerified);
    if (iso && (!latest || iso > latest)) latest = iso;
  }

  return latest;
}

export function LastUpdatedBadge() {
  const isoDate = getAtlasLastUpdatedIsoDate();

  return (
    <div className="inline-flex items-center gap-mdt-2 rounded-mdt-pill border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-1 text-body-xs text-mdt-muted">
      <span>Last updated</span>
      {isoDate ? (
        <time dateTime={isoDate} className="font-mono text-mdt-text">
          {isoDate}
        </time>
      ) : (
        <span aria-label="Last updated unknown" className="font-mono text-mdt-text">
          —
        </span>
      )}
    </div>
  );
}

