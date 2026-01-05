import fs from "node:fs/promises";
import path from "node:path";

export type DocKind = "registry" | "inventory";

export type DocSnapshot = {
  kind: DocKind;
  content: string;
  contentType: string;
  sha256: string;
  sizeBytes: number;
  refreshedAt: string;
  source: string;
  etag?: string | null;
};

const LAST_GOOD_FILE = "last-good.json";

function resolveRoot(rootOverride?: string): string {
  return rootOverride ?? process.env.DOC_STORE_PATH ?? path.resolve(process.cwd(), ".cache/docs");
}

function dirFor(kind: DocKind, rootOverride?: string): string {
  return path.join(resolveRoot(rootOverride), kind);
}

async function readSnapshotFile(kind: DocKind, fileName: string, rootOverride?: string): Promise<DocSnapshot | null> {
  const filePath = path.join(dirFor(kind, rootOverride), fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as DocSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeSnapshotFile(kind: DocKind, fileName: string, snapshot: DocSnapshot, rootOverride?: string): Promise<void> {
  const dir = dirFor(kind, rootOverride);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), JSON.stringify(snapshot, null, 2), "utf8");
}

export async function readLastGood(kind: DocKind, rootOverride?: string): Promise<DocSnapshot | null> {
  return readSnapshotFile(kind, LAST_GOOD_FILE, rootOverride);
}

export async function writeLastGood(snapshot: DocSnapshot, rootOverride?: string): Promise<void> {
  await writeSnapshotFile(snapshot.kind, LAST_GOOD_FILE, snapshot, rootOverride);
}
