import { beforeEach, describe, expect, it, vi } from "vitest";

type WorkspaceRecord = {
  id: string;
  snapshotId: string;
  createdAt: Date;
  updatedAt: Date;
};

type WorkspaceFileEditRecord = {
  id: string;
  workspaceId: string;
  path: string;
  content: string;
  hash?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const workspaces: WorkspaceRecord[] = [];
const workspaceFileEdits: WorkspaceFileEditRecord[] = [];

const requireSessionMock = vi.fn();
vi.mock("@/lib/requireSession", () => ({ requireSession: requireSessionMock }));

const prismaMock = {
  snapshot: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: vi.fn(async ({ where }: any) => {
      // Allow access if userId is "user-1"
      if (where.project?.userId === "user-1") {
        return { id: where.id ?? "snap-1" };
      }
      return null;
    }),
  },
  workspace: {
    create: vi.fn(async ({ data }: { data: { snapshotId: string } }) => {
      const record: WorkspaceRecord = {
        id: `workspace-${workspaces.length + 1}`,
        snapshotId: data.snapshotId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      workspaces.push(record);
      return record;
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: vi.fn(async ({ where }: any) => {
      // Check ownership
      if (where.snapshot?.project?.userId === "user-1") {
        return workspaces.find((w) => w.id === where.id) ?? null;
      }
      return null;
    }),
  },
  workspaceFileEdit: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsert: vi.fn(async ({ create, update, where }: any) => {
      const existingIndex = workspaceFileEdits.findIndex(
        (e) =>
          e.workspaceId === where.workspaceId_path.workspaceId &&
          e.path === where.workspaceId_path.path
      );
      if (existingIndex === -1) {
        const record = {
          id: `edit-${workspaceFileEdits.length + 1}`,
          workspaceId: create.workspaceId,
          path: create.path,
          content: create.content,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        workspaceFileEdits.push(record);
        return record;
      }
      const existing = workspaceFileEdits[existingIndex];
      workspaceFileEdits[existingIndex] = {
        ...existing,
        content: update.content,
        updatedAt: new Date(),
      };
      return workspaceFileEdits[existingIndex];
    }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, hasDatabaseEnv: true }));

const workspacesRoute = import("@/app/api/workspaces/route");

describe("workspaces API", () => {
  beforeEach(() => {
    workspaces.length = 0;
    workspaceFileEdits.length = 0;
    requireSessionMock.mockReset();
  });

  it("creates a workspace", async () => {
    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
    });
    const { POST } = await workspacesRoute;
    const res = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ snapshotId: "snap-1" }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.snapshotId).toBe("snap-1");
    expect(workspaces).toHaveLength(1);
  });

  it("saves file edits", async () => {
    const workspaceId = "workspace-1";
    // Seed workspace
    workspaces.push({
        id: workspaceId,
        snapshotId: "snap-1",
        createdAt: new Date(),
        updatedAt: new Date()
    });

    const fileEditRoute = await import(
      "@/app/api/workspaces/[workspaceId]/files/route"
    );
    const { POST } = fileEditRoute;

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
    });
    const ctx = { params: Promise.resolve({ workspaceId }) };

    const res = await POST(
      new Request(`http://localhost/api/workspaces/${workspaceId}/files`, {
        method: "POST",
        body: JSON.stringify({ path: "README.md", content: "Hello" }),
      }),
      ctx
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.content).toBe("Hello");
    expect(workspaceFileEdits).toHaveLength(1);

    // Update
    const res2 = await POST(
      new Request(`http://localhost/api/workspaces/${workspaceId}/files`, {
        method: "POST",
        body: JSON.stringify({ path: "README.md", content: "Hello World" }),
      }),
      ctx
    );
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.content).toBe("Hello World");
    expect(workspaceFileEdits).toHaveLength(1);
  });
});
