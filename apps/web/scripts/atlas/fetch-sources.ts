import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { safeFetch, type DnsLookup } from "./http.ts";
import { loadAtlasSources } from "../../src/lib/atlas/sources.ts";

type SnapshotMeta = {
  url: string;
  fetchedAt: string;
  etag: string | null;
  lastModified: string | null;
  sha256: string;
};

function timestampForFile(date: Date): string {
  return date.toISOString().replace(/:/g, "-");
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function latestMeta(snapshotDir: string): SnapshotMeta | null {
  if (!fs.existsSync(snapshotDir)) return null;
  const files = fs
    .readdirSync(snapshotDir)
    .filter((name) => name.endsWith(".meta.json"))
    .sort();
  if (files.length === 0) return null;
  const filePath = path.join(snapshotDir, files[files.length - 1]);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as SnapshotMeta;
}

export type FetchSourcesResult = {
  fetched: number;
  skipped: number;
  errors: number;
};

export type FetchSourcesOptions = {
  atlasDir?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  dnsLookup?: DnsLookup;
};

export async function fetchAtlasSources(options?: FetchSourcesOptions): Promise<FetchSourcesResult> {
  const atlasDir = options?.atlasDir ?? path.join(process.cwd(), "atlas");
  const sourcesFile = loadAtlasSources({ atlasDir });
  const allowedUrls = sourcesFile.sources.map((s) => s.url);

  const out: FetchSourcesResult = { fetched: 0, skipped: 0, errors: 0 };

  for (const source of sourcesFile.sources) {
    const snapshotDir = path.join(atlasDir, "snapshots", source.id);
    fs.mkdirSync(snapshotDir, { recursive: true });

    const prev = latestMeta(snapshotDir);
    const headers: Record<string, string> = {};
    if (prev?.etag) headers["If-None-Match"] = prev.etag;
    if (prev?.lastModified) headers["If-Modified-Since"] = prev.lastModified;

    let res: Response;
    try {
      res = await safeFetch(source.url, {
        allowedUrls,
        fetchImpl: options?.fetchImpl,
        dnsLookup: options?.dnsLookup,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
    } catch (error) {
      out.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[atlas:fetch] ${source.id} ${source.url}\n${message}\n`);
      continue;
    }

    if (res.status === 304) {
      out.skipped += 1;
      continue;
    }

    if (!res.ok) {
      out.errors += 1;
      console.error(`[atlas:fetch] ${source.id} ${source.url}\nHTTP ${res.status}\n`);
      continue;
    }

    const body = await res.text();
    const fetchedAt = (options?.now ?? (() => new Date()))();
    const ts = timestampForFile(fetchedAt);

    const htmlPath = path.join(snapshotDir, `${ts}.html`);
    const metaPath = path.join(snapshotDir, `${ts}.meta.json`);

    fs.writeFileSync(htmlPath, body, "utf8");

    const meta: SnapshotMeta = {
      url: source.url,
      fetchedAt: fetchedAt.toISOString(),
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      sha256: sha256(body),
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");

    out.fetched += 1;
  }

  return out;
}

async function main() {
  const result = await fetchAtlasSources();
  if (result.errors > 0) process.exitCode = 1;
  console.log(`[atlas:fetch] fetched=${result.fetched} skipped=${result.skipped} errors=${result.errors}`);
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  void main();
}

