import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DocKind, DocSnapshot, readLastGood, writeLastGood } from "@/lib/storage/docStore";

type RegistrySource = {
  version: string;
  allowlistHosts: string[];
  sources: RegistryEntry[];
};

type RegistryEntry = {
  id: string;
  tier: string;
  client: string;
  url: string;
  refreshHours: number;
  tags?: string[];
  notes?: string;
};

type InventorySource = {
  version: string;
  updatedAt?: string;
  documents: InventoryEntry[];
};

type InventoryEntry = {
  id: string;
  title: string;
  url: string;
  client?: string;
  tags?: string[];
  checksum?: string;
};

export type RefreshConfig = {
  registrySource?: string;
  inventorySource?: string;
  timeoutMs?: number;
  storeRoot?: string;
};

export type RefreshItemResult = {
  kind: DocKind;
  source: string;
  snapshot?: DocSnapshot;
  fallback?: DocSnapshot | null;
  error?: string;
  updated: boolean;
  attemptedAt: string;
};

export type RefreshResult = {
  items: RefreshItemResult[];
};

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_DOC_BYTES = 2_000_000;

const DEFAULT_REGISTRY_CANDIDATES = [
  "cli/data/doc-sources.json",
  "../cli/data/doc-sources.json",
  "../../cli/data/doc-sources.json",
];

const DEFAULT_INVENTORY_CANDIDATES = [
  "docs/doc-inventory.json",
  "../docs/doc-inventory.json",
  "../../docs/doc-inventory.json",
];

type ResolvedSource =
  | { ok: true; value: string }
  | { ok: false; error: string };

export async function refreshDocumentation(config: RefreshConfig = {}): Promise<RefreshResult> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const [registrySource, inventorySource] = await Promise.all([
    resolveSource("registry", config.registrySource).then<ResolvedSource>(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    ),
    resolveSource("inventory", config.inventorySource).then<ResolvedSource>(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    ),
  ]);

  const registryResult = await refreshSingle("registry", registrySource, timeoutMs, config.storeRoot);
  const inventoryResult = await refreshSingle("inventory", inventorySource, timeoutMs, config.storeRoot);

  return { items: [registryResult, inventoryResult] };
}

export async function loadDocSnapshot(kind: DocKind, storeRoot?: string): Promise<DocSnapshot | null> {
  return readLastGood(kind, storeRoot);
}

export function hasHardFailure(result: RefreshResult): boolean {
  return result.items.some((item) => item.error && !item.fallback);
}

async function refreshSingle(
  kind: DocKind,
  source: ResolvedSource,
  timeoutMs: number,
  storeRoot?: string,
): Promise<RefreshItemResult> {
  const attemptedAt = new Date().toISOString();
  const lastGood = await readLastGood(kind, storeRoot);

  if (!source.ok) {
    return {
      kind,
      source: "(unresolved)",
      fallback: lastGood,
      error: source.error,
      updated: false,
      attemptedAt,
    };
  }

  try {
    const fetched = await fetchDocument(source.value, timeoutMs);
    const canonical = canonicalize(kind, fetched.content);
    const snapshot = buildSnapshot(kind, canonical, fetched.contentType, fetched.source);
    await writeLastGood(snapshot, storeRoot);

    return {
      kind,
      source: fetched.source,
      snapshot,
      updated: !lastGood || lastGood.sha256 !== snapshot.sha256,
      attemptedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      kind,
      source: source.value,
      fallback: lastGood,
      error: message,
      updated: false,
      attemptedAt,
    };
  }
}

function canonicalize(kind: DocKind, content: string): string {
  switch (kind) {
    case "registry": {
      const parsed = validateRegistry(content);
      return JSON.stringify(parsed, null, 2);
    }
    case "inventory": {
      const parsed = validateInventory(content);
      return JSON.stringify(parsed, null, 2);
    }
    default:
      return content;
  }
}

type FetchedDocument = {
  content: string;
  contentType: string;
  source: string;
};

async function fetchDocument(source: string, timeoutMs: number): Promise<FetchedDocument> {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return fetchRemote(source, timeoutMs);
  }

  if (source.startsWith("file://")) {
    return readLocalFile(fileURLToPath(source));
  }

  return readLocalFile(source);
}

async function fetchRemote(url: string, timeoutMs: number): Promise<FetchedDocument> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Fetch failed (${response.status}): ${body || response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    enforceSize(buffer);
    return {
      content: buffer.toString("utf8"),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      source: url,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readLocalFile(p: string): Promise<FetchedDocument> {
  const resolved = path.isAbsolute(p) ? p : path.resolve(p);
  const buffer = await fs.readFile(resolved);
  enforceSize(buffer);
  return {
    content: buffer.toString("utf8"),
    contentType: resolved.endsWith(".json") ? "application/json" : "text/plain",
    source: resolved,
  };
}

function enforceSize(buffer: Buffer) {
  if (buffer.byteLength === 0) {
    throw new Error("Document is empty");
  }
  if (buffer.byteLength > MAX_DOC_BYTES) {
    throw new Error(`Document exceeds size limit (${MAX_DOC_BYTES} bytes)`);
  }
}

function buildSnapshot(kind: DocKind, content: string, contentType: string, source: string): DocSnapshot {
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  return {
    kind,
    content,
    contentType,
    sha256,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    refreshedAt: new Date().toISOString(),
    source,
  };
}

async function resolveSource(kind: DocKind, override?: string): Promise<string> {
  if (override) return override;

  const envPath = kind === "registry" ? process.env.DOC_REGISTRY_PATH : process.env.DOC_INVENTORY_PATH;
  if (envPath) return envPath;

  const envUrl = kind === "registry" ? process.env.DOC_REGISTRY_URL : process.env.DOC_INVENTORY_URL;
  if (envUrl) return envUrl;

  const candidates = kind === "registry" ? DEFAULT_REGISTRY_CANDIDATES : DEFAULT_INVENTORY_CANDIDATES;
  const resolved = await firstExistingFile(candidates);
  if (resolved) return resolved;

  throw new Error(`No source configured for ${kind}`);
}

async function firstExistingFile(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(candidate);
    try {
      await fs.access(resolved);
      return resolved;
    } catch {
      continue;
    }
  }
  return null;
}

function validateRegistry(raw: string): RegistrySource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Invalid registry JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Registry must be an object");
  }
  const reg = parsed as Partial<RegistrySource>;
  if (!reg.version || typeof reg.version !== "string") {
    throw new Error("Registry missing version");
  }
  if (!Array.isArray(reg.allowlistHosts) || reg.allowlistHosts.length === 0) {
    throw new Error("Registry missing allowlistHosts");
  }
  if (!Array.isArray(reg.sources) || reg.sources.length === 0) {
    throw new Error("Registry missing sources");
  }

  const allowlist = new Set(reg.allowlistHosts.map((host) => host.trim().toLowerCase()).filter(Boolean));
  const seenIds = new Set<string>();

  reg.sources.forEach((src, index) => {
    if (!src || typeof src !== "object") {
      throw new Error(`Registry source ${index} invalid`);
    }
    if (typeof src.id !== "string" || !src.id.trim()) {
      throw new Error("Registry source missing id");
    }
    if (seenIds.has(src.id)) {
      throw new Error(`Duplicate registry id: ${src.id}`);
    }
    seenIds.add(src.id);

    if (typeof src.client !== "string" || !src.client.trim()) {
      throw new Error(`Registry source ${src.id} missing client`);
    }
    if (typeof src.tier !== "string" || !src.tier.trim()) {
      throw new Error(`Registry source ${src.id} missing tier`);
    }
    if (typeof src.url !== "string" || !src.url.trim()) {
      throw new Error(`Registry source ${src.id} missing url`);
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(src.url);
    } catch (error) {
      throw new Error(`Registry source ${src.id} has invalid url: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error(`Registry source ${src.id} must use https`);
    }
    if (allowlist.size > 0 && !allowlist.has(parsedUrl.hostname.toLowerCase())) {
      throw new Error(`Registry source ${src.id} host ${parsedUrl.hostname} not in allowlist`);
    }
    if (typeof src.refreshHours !== "number" || src.refreshHours <= 0) {
      throw new Error(`Registry source ${src.id} missing refreshHours`);
    }
    if (src.tags && !Array.isArray(src.tags)) {
      throw new Error(`Registry source ${src.id} has invalid tags`);
    }
  });

  return {
    version: reg.version,
    allowlistHosts: reg.allowlistHosts,
    sources: reg.sources,
  };
}

function validateInventory(raw: string): InventorySource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Invalid inventory JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Inventory must be an object");
  }

  const inv = parsed as Partial<InventorySource>;
  if (!inv.version || typeof inv.version !== "string") {
    throw new Error("Inventory missing version");
  }
  if (!Array.isArray(inv.documents) || inv.documents.length === 0) {
    throw new Error("Inventory missing documents");
  }

  const seenIds = new Set<string>();
  inv.documents.forEach((doc, index) => {
    if (!doc || typeof doc !== "object") {
      throw new Error(`Inventory entry ${index} invalid`);
    }
    if (typeof doc.id !== "string" || !doc.id.trim()) {
      throw new Error("Inventory entry missing id");
    }
    if (seenIds.has(doc.id)) {
      throw new Error(`Duplicate inventory id: ${doc.id}`);
    }
    seenIds.add(doc.id);

    if (typeof doc.title !== "string" || !doc.title.trim()) {
      throw new Error(`Inventory entry ${doc.id} missing title`);
    }
    if (typeof doc.url !== "string" || !doc.url.trim()) {
      throw new Error(`Inventory entry ${doc.id} missing url`);
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(doc.url);
    } catch (error) {
      throw new Error(`Inventory entry ${doc.id} has invalid url: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error(`Inventory entry ${doc.id} must use https`);
    }
    if (doc.tags && !Array.isArray(doc.tags)) {
      throw new Error(`Inventory entry ${doc.id} has invalid tags`);
    }
  });

  return {
    version: inv.version,
    updatedAt: inv.updatedAt,
    documents: inv.documents,
  };
}
