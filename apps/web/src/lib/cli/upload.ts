import type { Blob, Prisma, Project, Snapshot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateUploadManifest } from "@/lib/cli/validation";
import { buildUploadPlan, type UploadPlan } from "@/lib/storage/s3";
import { requireCliToken, type RequireCliTokenResult } from "@/lib/requireCliToken";

export type { RequireCliTokenResult };

export type ManifestEntryInput = {
  path: string;
  blobHash: string;
  sizeBytes: number;
  mode?: number | null;
  mtime?: string | number | null;
  isDeleted?: boolean | null;
  contentType?: string | null;
  isBinary?: boolean | null;
};

export type ManifestEntry = {
  path: string;
  blobHash: string;
  sizeBytes: number;
  mode?: number | null;
  mtime?: Date | null;
  isDeleted: boolean;
  contentType?: string | null;
  isBinary: boolean;
  orderIndex: number;
};

export type UploadHandshakeInput = {
  projectId?: string | null;
  projectSlug?: string | null;
  projectName?: string | null;
  provider?: string | null;
  repoRoot?: string | null;
  protocolVersion?: string | null;
  idempotencyKey?: string | null;
  baseSnapshotId?: string | null;
  manifestHash?: string | null;
  metadata?: unknown;
  manifest: ManifestEntryInput[];
};

export type UploadHandshakeResult = {
  snapshotId: string;
  missingBlobs: string[];
  upload: UploadPlan;
};

export { requireCliToken };

export async function createUploadHandshake(options: {
  userId: string;
  input: UploadHandshakeInput;
  origin: string;
}): Promise<UploadHandshakeResult> {
  const { userId, input, origin } = options;
  const validationError = validateUploadManifest(input.manifest);
  if (validationError) {
    throw new Error(validationError);
  }
  const manifest = normalizeManifest(input.manifest);

  const project = await resolveProject(userId, input);
  const snapshot = await resolveSnapshot(project, input);

  const { blobMap, missingBlobs } = await ensureBlobs(manifest);
  await ensureSnapshotFiles(snapshot.id, manifest, blobMap);

  const upload = await buildUploadPlan({
    origin,
    blobs: missingBlobs.map((hash) => ({ hash, sizeBytes: blobMap.get(hash)?.sizeBytes ?? 0 })),
  });

  return {
    snapshotId: snapshot.id,
    missingBlobs,
    upload,
  };
}

export async function finalizeSnapshotUpload(options: {
  userId: string;
  snapshotId: string;
}): Promise<{ missingBlobs: string[]; snapshot: Snapshot }> {
  const snapshot = await prisma.snapshot.findFirst({
    where: { id: options.snapshotId, project: { userId: options.userId } },
  });
  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  if (snapshot.status === "READY") {
    return { missingBlobs: [], snapshot };
  }

  const files = await prisma.snapshotFile.findMany({
    where: { snapshotId: snapshot.id },
    include: { blob: true },
  });

  const missing = new Set<string>();
  for (const file of files) {
    if (file.isDeleted) continue;
    if (!file.blob.content && !file.blob.storageKey) {
      missing.add(file.blob.sha256);
    }
  }

  const missingBlobs = Array.from(missing);
  if (missingBlobs.length > 0) {
    return { missingBlobs, snapshot };
  }

  const updated = await prisma.snapshot.update({
    where: { id: snapshot.id },
    data: { status: "READY", finalizedAt: new Date() },
  });

  return { missingBlobs, snapshot: updated };
}

function normalizeManifest(entries: ManifestEntryInput[]): ManifestEntry[] {
  const seenPaths = new Set<string>();
  const normalized: ManifestEntry[] = [];

  entries.forEach((entry, index) => {
    if (seenPaths.has(entry.path)) {
      throw new Error(`Duplicate manifest path: ${entry.path}`);
    }
    seenPaths.add(entry.path);

    normalized.push({
      path: entry.path,
      blobHash: entry.blobHash,
      sizeBytes: entry.sizeBytes,
      mode: entry.mode ?? null,
      mtime: normalizeMtime(entry.mtime),
      isDeleted: Boolean(entry.isDeleted),
      contentType: entry.contentType ?? null,
      isBinary: Boolean(entry.isBinary),
      orderIndex: index,
    });
  });

  return normalized;
}

function normalizeMtime(value?: string | number | null): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveProject(userId: string, input: UploadHandshakeInput): Promise<Project> {
  if (input.projectId) {
    const project = await prisma.project.findFirst({ where: { id: input.projectId, userId } });
    if (!project) {
      throw new Error("Project not found");
    }
    return project;
  }

  if (input.projectSlug) {
    const existing = await prisma.project.findFirst({
      where: { slug: input.projectSlug, userId },
    });
    if (existing) return existing;
  }

  if (!input.projectName && !input.projectSlug) {
    throw new Error("Missing project identifier");
  }

  const name = input.projectName ?? input.projectSlug ?? "Untitled";
  return prisma.project.create({
    data: {
      userId,
      name,
      slug: input.projectSlug ?? null,
      provider: input.provider ?? null,
    },
  });
}

async function resolveSnapshot(project: Project, input: UploadHandshakeInput): Promise<Snapshot> {
  if (input.idempotencyKey) {
    const existing = await prisma.snapshot.findFirst({
      where: { projectId: project.id, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (input.manifestHash && existing.manifestHash && input.manifestHash !== existing.manifestHash) {
        throw new Error("Manifest hash mismatch for idempotent snapshot");
      }
      return existing;
    }
  }

  const manifestHash = input.manifestHash ?? null;
  return prisma.snapshot.create({
    data: {
      projectId: project.id,
      baseSnapshotId: input.baseSnapshotId ?? null,
      repoRoot: input.repoRoot ?? null,
      manifestHash,
      protocolVersion: input.protocolVersion ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      status: "UPLOADING",
      source: "cli",
    },
  });
}

async function ensureBlobs(manifest: ManifestEntry[]): Promise<{
  blobMap: Map<string, Blob>;
  missingBlobs: string[];
}> {
  const sizeByHash = new Map<string, number>();
  const activeHashes = new Set<string>();
  for (const entry of manifest) {
    const existing = sizeByHash.get(entry.blobHash);
    if (existing !== undefined && existing !== entry.sizeBytes) {
      throw new Error(`Blob size mismatch for ${entry.blobHash}`);
    }
    sizeByHash.set(entry.blobHash, entry.sizeBytes);
    if (!entry.isDeleted) {
      activeHashes.add(entry.blobHash);
    }
  }

  const hashes = Array.from(sizeByHash.keys());
  const existing = await prisma.blob.findMany({ where: { sha256: { in: hashes } } });

  const missing = new Set<string>();
  const existingMap = new Map(existing.map((blob) => [blob.sha256, blob]));

  for (const hash of hashes) {
    const blob = existingMap.get(hash);
    if (blob && blob.sizeBytes !== sizeByHash.get(hash)) {
      throw new Error(`Blob size mismatch for ${hash}`);
    }
    if (activeHashes.has(hash) && (!blob || (!blob.content && !blob.storageKey))) {
      missing.add(hash);
    }
  }

  const missingRecords = Array.from(missing).map((hash) => ({
    sha256: hash,
    sizeBytes: sizeByHash.get(hash) ?? 0,
  }));

  if (missingRecords.length > 0) {
    await prisma.blob.createMany({ data: missingRecords, skipDuplicates: true });
  }

  const all = await prisma.blob.findMany({ where: { sha256: { in: hashes } } });
  const blobMap = new Map(all.map((blob) => [blob.sha256, blob]));

  return { blobMap, missingBlobs: Array.from(missing) };
}

async function ensureSnapshotFiles(snapshotId: string, manifest: ManifestEntry[], blobMap: Map<string, Blob>) {
  const files = manifest.map((entry) => {
    const blob = blobMap.get(entry.blobHash);
    if (!blob) {
      throw new Error(`Missing blob record for ${entry.blobHash}`);
    }

    return {
      snapshotId,
      path: entry.path,
      blobId: blob.id,
      sizeBytes: entry.sizeBytes,
      contentType: entry.contentType,
      isBinary: entry.isBinary,
      mode: entry.mode ?? null,
      mtime: entry.mtime,
      orderIndex: entry.orderIndex,
      isDeleted: entry.isDeleted,
      deletedAt: entry.isDeleted ? new Date() : null,
    };
  });

  if (files.length === 0) return;

  await prisma.snapshotFile.createMany({ data: files, skipDuplicates: true });
}
