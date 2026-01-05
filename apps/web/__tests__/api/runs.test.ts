import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/rateLimiter";

type ProjectRecord = {
  id: string;
  userId: string;
  name: string;
};

type SnapshotRecord = {
  id: string;
  projectId: string;
  status: "UPLOADING" | "READY" | "CREATED";
  createdAt: Date;
  updatedAt: Date;
};

type RunRecord = {
  id: string;
  snapshotId: string;
  type: "AUDIT" | "SUGGEST";
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";
  input?: unknown;
  output?: unknown;
  error?: string | null;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

const projects: ProjectRecord[] = [];
const snapshots: SnapshotRecord[] = [];
const runs: RunRecord[] = [];

const requireCliTokenMock = vi.fn();
const runWorkerMock = vi.fn();
const emitRunEventMock = vi.fn();

vi.mock("@/lib/requireCliToken", () => ({ requireCliToken: requireCliTokenMock }));
vi.mock("@/lib/engine/workerClient", () => ({ runWorker: runWorkerMock }));
vi.mock("@/lib/events/runEvents", () => ({ emitRunEvent: emitRunEventMock }));

const prismaMock = {
  snapshot: {
    findFirst: vi.fn(async ({ where }: { where: { id?: string; project?: { userId?: string } } }) => {
      const match = snapshots.find((snapshot) => {
        if (where.id && snapshot.id !== where.id) return false;
        if (where.project?.userId) {
          const project = projects.find((item) => item.id === snapshot.projectId);
          if (!project || project.userId !== where.project.userId) return false;
        }
        return true;
      });
      return match ?? null;
    }),
  },
  run: {
    findMany: vi.fn(async ({ where }: { where: { snapshotId: string; type?: string } }) => {
      return runs.filter((run) => run.snapshotId === where.snapshotId && (!where.type || run.type === where.type));
    }),
    findFirst: vi.fn(async ({ where }: { where: { snapshotId: string; type?: string; status?: { in: string[] } } }) => {
      const matches = runs.filter((run) => {
        if (run.snapshotId !== where.snapshotId) return false;
        if (where.type && run.type !== where.type) return false;
        if (where.status?.in && !where.status.in.includes(run.status)) return false;
        return true;
      });
      return matches[0] ?? null;
    }),
    create: vi.fn(async ({ data }: { data: Omit<RunRecord, "id" | "createdAt"> }) => {
      const record: RunRecord = {
        id: `run-${runs.length + 1}`,
        createdAt: new Date(),
        ...data,
      } as RunRecord;
      runs.push(record);
      return record;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<RunRecord> }) => {
      const index = runs.findIndex((run) => run.id === where.id);
      if (index === -1) throw new Error("Run not found");
      runs[index] = { ...runs[index], ...data } as RunRecord;
      return runs[index];
    }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, hasDatabaseEnv: true }));

const runsRoute = import("@/app/api/snapshots/[snapshotId]/runs/route");

type RouteContext = { params: Promise<{ snapshotId: string }> };

function seedProject() {
  const project = { id: "project-1", userId: "user-1", name: "Demo" };
  projects.push(project);
  return project;
}

function seedSnapshot(projectId: string, id: string, status: SnapshotRecord["status"] = "READY") {
  const snapshot: SnapshotRecord = {
    id,
    projectId,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  snapshots.push(snapshot);
  return snapshot;
}

describe("runs API", () => {
  beforeEach(() => {
    projects.length = 0;
    snapshots.length = 0;
    runs.length = 0;
    resetRateLimitStore();
    requireCliTokenMock.mockReset();
    runWorkerMock.mockReset();
    emitRunEventMock.mockReset();
  });

  it("requires CLI auth for run list", async () => {
    requireCliTokenMock.mockResolvedValueOnce({ response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const { GET } = await runsRoute;
    const ctx: RouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await GET(new Request("http://localhost/api/snapshots/snapshot-1/runs"), ctx);
    expect(res.status).toBe(401);
  });

  it("lists runs for a snapshot", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1");
    runs.push({
      id: "run-1",
      snapshotId: "snapshot-1",
      type: "AUDIT",
      status: "SUCCESS",
      createdAt: new Date(),
    });
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });

    const { GET } = await runsRoute;
    const ctx: RouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await GET(new Request("http://localhost/api/snapshots/snapshot-1/runs"), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.runs).toHaveLength(1);
    expect(json.runs[0].id).toBe("run-1");
  });

  it("creates a run and stores results", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1");
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    runWorkerMock.mockResolvedValue({ id: "run-1", type: "audit", ok: true, audit: { output: { issues: [] } } });

    const { POST } = await runsRoute;
    const ctx: RouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await POST(
      new Request("http://localhost/api/snapshots/snapshot-1/runs", {
        method: "POST",
        body: JSON.stringify({ type: "audit", input: { audit: { scan: { schemaVersion: "scan-spec-v1" } } } }),
      }),
      ctx
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.run.status).toBe("SUCCESS");
    expect(runWorkerMock).toHaveBeenCalled();
  });

  it("de-duplicates active runs", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1");
    runs.push({
      id: "run-1",
      snapshotId: "snapshot-1",
      type: "AUDIT",
      status: "RUNNING",
      createdAt: new Date(),
    });
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });

    const { POST } = await runsRoute;
    const ctx: RouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await POST(
      new Request("http://localhost/api/snapshots/snapshot-1/runs", {
        method: "POST",
        body: JSON.stringify({ type: "audit" }),
      }),
      ctx
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.run.id).toBe("run-1");
    expect(runWorkerMock).not.toHaveBeenCalled();
  });

  it("fails run when worker reports error", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1");
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    runWorkerMock.mockResolvedValue({ id: "run-1", type: "audit", ok: false, error: { message: "boom" } });

    const { POST } = await runsRoute;
    const ctx: RouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await POST(
      new Request("http://localhost/api/snapshots/snapshot-1/runs", {
        method: "POST",
        body: JSON.stringify({ type: "audit" }),
      }),
      ctx
    );

    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.run.status).toBe("FAILED");
    expect(json.error).toBe("boom");
  });

  it("rejects runs when snapshot is not ready", async () => {
    seedProject();
    seedSnapshot("project-1", "snapshot-1", "UPLOADING");
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });

    const { POST } = await runsRoute;
    const ctx: RouteContext = { params: Promise.resolve({ snapshotId: "snapshot-1" }) };

    const res = await POST(
      new Request("http://localhost/api/snapshots/snapshot-1/runs", {
        method: "POST",
        body: JSON.stringify({ type: "audit" }),
      }),
      ctx
    );

    expect(res.status).toBe(409);
  });
});
