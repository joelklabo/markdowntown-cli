import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/rateLimiter";

type ProjectRecord = {
  id: string;
  userId: string;
  name: string;
  slug?: string | null;
  provider?: string | null;
};

type SnapshotRecord = {
  id: string;
  projectId: string;
  baseSnapshotId?: string | null;
  source?: string | null;
  repoRoot?: string | null;
  manifestHash?: string | null;
  protocolVersion?: string | null;
  idempotencyKey?: string | null;
  status?: "UPLOADING" | "READY" | "CREATED";
  finalizedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: unknown;
};

type BlobRecord = {
  id: string;
  sha256: string;
  sizeBytes: number;
  content?: Buffer | null;
  storageKey?: string | null;
};

type SnapshotFileRecord = {
  id: string;
  snapshotId: string;
  path: string;
  blobId: string;
  sizeBytes: number;
  contentType?: string | null;
  isBinary?: boolean;
  mode?: number | null;
  mtime?: Date | null;
  orderIndex?: number;
  isDeleted?: boolean;
  deletedAt?: Date | null;
};

const projects: ProjectRecord[] = [];
const snapshots: SnapshotRecord[] = [];
const blobs: BlobRecord[] = [];
const snapshotFiles: SnapshotFileRecord[] = [];

const requireCliTokenMock = vi.fn();

vi.mock("@/lib/requireCliToken", () => ({ requireCliToken: requireCliTokenMock }));

const prismaMock = {
  project: {
    findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string } }) =>
      projects.find((project) =>
        (!where.id || project.id === where.id) && (!where.userId || project.userId === where.userId)
      ) ?? null
    ),
  },
  snapshot: {
    findMany: vi.fn(async ({ where }: { where: { projectId: string; status?: string } }) => {
      const filtered = snapshots.filter((snapshot) =>
        snapshot.projectId === where.projectId && (!where.status || snapshot.status === where.status)
      );
      return filtered.map((snapshot) => ({
        ...snapshot,
        _count: {
          files: snapshotFiles.filter((file) => file.snapshotId === snapshot.id).length,
          runs: 0,
          patches: 0,
          auditIssues: 0,
        },
      }));
    }),
    findFirst: vi.fn(async ({ where }: { where: { id?: string; projectId?: string; idempotencyKey?: string; project?: { userId?: string } } }) => {
      const match = snapshots.find((snapshot) => {
        if (where.id && snapshot.id !== where.id) return false;
        if (where.projectId && snapshot.projectId !== where.projectId) return false;
        if (where.idempotencyKey && snapshot.idempotencyKey !== where.idempotencyKey) return false;
        if (where.project?.userId) {
          const project = projects.find((item) => item.id === snapshot.projectId);
          if (!project || project.userId !== where.project.userId) return false;
        }
        return true;
      });

      if (!match) return null;

      if (where.project?.userId) {
        const project = projects.find((item) => item.id === match.projectId) ?? null;
        return {
          ...match,
          project,
          _count: {
            files: snapshotFiles.filter((file) => file.snapshotId === match.id).length,
            runs: 0,
            patches: 0,
            auditIssues: 0,
          },
        };
      }

      return match;
    }),
    create: vi.fn(async ({ data }: { data: Omit<SnapshotRecord, "id" | "createdAt" | "updatedAt"> }) => {
      const created: SnapshotRecord = {
        id: `snapshot-${snapshots.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      snapshots.push(created);
      return created;
    }),
  },
  snapshotFile: {
    findFirst: vi.fn(async ({ where }: { where: { snapshotId: string; path: string } }) =>
      snapshotFiles.find((file) => file.snapshotId === where.snapshotId && file.path === where.path) ?? null
    ),
    findMany: vi.fn(async ({ where }: { where: { snapshotId: string } }) =>
      snapshotFiles
        .filter((file) => file.snapshotId === where.snapshotId)
        .map((file) => ({
          ...file,
          blob: blobs.find((blob) => blob.id === file.blobId) ?? { sha256: "" },
        }))
    ),
    aggregate: vi.fn(async ({ where }: { where: { snapshotId: string; isDeleted: boolean } }) => {
      const files = snapshotFiles.filter(
        (file) => file.snapshotId === where.snapshotId && Boolean(file.isDeleted) === where.isDeleted
      );
      return {
        _count: files.length,
        _sum: { sizeBytes: files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0) },
      };
    }),
    upsert: vi.fn(async ({ create, update, where }: { create: SnapshotFileRecord; update: SnapshotFileRecord; where: { snapshotId_path: { snapshotId: string; path: string } } }) => {
      const existingIndex = snapshotFiles.findIndex(
        (file) => file.snapshotId === where.snapshotId_path.snapshotId && file.path === where.snapshotId_path.path
      );
      if (existingIndex === -1) {
        const record = { ...create, id: `file-${snapshotFiles.length + 1}` };
        snapshotFiles.push(record);
        return {
          ...record,
          blob: blobs.find((blob) => blob.id === record.blobId) ?? { sha256: "" },
        };
      }
      snapshotFiles[existingIndex] = { ...snapshotFiles[existingIndex], ...update };
      const record = snapshotFiles[existingIndex];
      return {
        ...record,
        blob: blobs.find((blob) => blob.id === record.blobId) ?? { sha256: "" },
      };
    }),
  },
  blob: {
    findUnique: vi.fn(async ({ where }: { where: { sha256: string } }) =>
      blobs.find((blob) => blob.sha256 === where.sha256) ?? null
    ),
    upsert: vi.fn(async ({ create, update, where }: { create: BlobRecord; update: BlobRecord; where: { sha256: string } }) => {
      const existingIndex = blobs.findIndex((blob) => blob.sha256 === where.sha256);
      if (existingIndex === -1) {
        const record = { ...create, id: `blob-${blobs.length + 1}` };
        blobs.push(record);
        return record;
      }
      blobs[existingIndex] = { ...blobs[existingIndex], ...update };
      return blobs[existingIndex];
    }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, hasDatabaseEnv: true }));

const projectSnapshotsRoute = import("@/app/api/projects/[projectId]/snapshots/route");
const snapshotDetailRoute = import("@/app/api/snapshots/[snapshotId]/route");
const snapshotFilesRoute = import("@/app/api/snapshots/[snapshotId]/files/route");

type ProjectRouteContext = { params: Promise<{ projectId: string }> };
type SnapshotRouteContext = { params: Promise<{ snapshotId: string }> };

function seedProject() {
  const project = { id: "project-1", userId: "user-1", name: "Demo" };
  projects.push(project);
  return project;
}

function seedSnapshot(projectId: string, id: string) {
  const snapshot: SnapshotRecord = {
    id,
    projectId,
    status: "UPLOADING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  snapshots.push(snapshot);
  return snapshot;
}

describe("snapshots API", () => {
  beforeEach(() => {
    projects.length = 0;
    snapshots.length = 0;
    blobs.length = 0;
    snapshotFiles.length = 0;
    resetRateLimitStore();
    requireCliTokenMock.mockReset();
  });

  it("requires CLI auth for snapshot list", async () => {
    requireCliTokenMock.mockResolvedValueOnce({ response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const { GET } = await projectSnapshotsRoute;
    const ctx: ProjectRouteContext = { params: Promise.resolve({ projectId: "project-1" }) };

    const res = await GET(new Request("http://localhost/api/projects/project-1/snapshots"), ctx);
    expect(res.status).toBe(401);
  });

  it("creates and lists snapshots for a project", async () => {
    seedProject();
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    const { POST, GET } = await projectSnapshotsRoute;
    const ctx: ProjectRouteContext = { params: Promise.resolve({ projectId: "project-1" }) };

    const createRes = await POST(
      new Request("http://localhost/api/projects/project-1/snapshots", {
        method: "POST",
        body: JSON.stringify({ protocolVersion: "1" }),
      }),
      ctx
    );

    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.snapshot.projectId).toBe("project-1");

    const listRes = await GET(new Request("http://localhost/api/projects/project-1/snapshots"), ctx);
    const listJson = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(listJson.snapshots).toHaveLength(1);
  });

  it("returns snapshot details scoped to the token user", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1");
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });

    const { GET } = await snapshotDetailRoute;
    const ctx: SnapshotRouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };
    const res = await GET(new Request("http://localhost/api/snapshots/snapshot-1"), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.snapshot.id).toBe("snapshot-1");
  });

  it("rejects file upload without content", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1");
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });

    const { POST } = await snapshotFilesRoute;
    const ctx: SnapshotRouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await POST(
      new Request("http://localhost/api/snapshots/snapshot-1/files", {
        method: "POST",
        body: JSON.stringify({
          path: "README.md",
          blobHash: "a".repeat(64),
          sizeBytes: 12,
        }),
      }),
      ctx
    );

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/missing blob content/i);
  });

  it("lists snapshot files", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1");
    const blob: BlobRecord = { id: "blob-1", sha256: "a".repeat(64), sizeBytes: 12 };
    blobs.push(blob);
    snapshotFiles.push({
      id: "file-1",
      snapshotId: "snapshot-1",
      path: "README.md",
      blobId: blob.id,
      sizeBytes: 12,
      orderIndex: 0,
      isDeleted: false,
    });
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });

    const { GET } = await snapshotFilesRoute;
    const ctx: SnapshotRouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await GET(new Request("http://localhost/api/snapshots/snapshot-1/files"), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.files).toHaveLength(1);
    expect(json.files[0].path).toBe("README.md");
  });
});
