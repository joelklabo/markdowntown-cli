import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/rateLimiter";

const { requireCliTokenMock, listAuditIssuesMock, storeAuditIssuesMock } = vi.hoisted(() => {
  return {
    requireCliTokenMock: vi.fn(),
    listAuditIssuesMock: vi.fn(),
    storeAuditIssuesMock: vi.fn(),
  };
});

vi.mock("@/lib/cli/upload", () => ({ requireCliToken: requireCliTokenMock }));
vi.mock("@/lib/prisma", () => ({ hasDatabaseEnv: true }));
vi.mock("@/lib/audit/store", () => ({
  listAuditIssues: listAuditIssuesMock,
  storeAuditIssues: storeAuditIssuesMock,
}));

const auditRoute = import("@/app/api/cli/audit/route");

describe("cli-audit API", () => {
  beforeEach(() => {
    resetRateLimitStore();
    requireCliTokenMock.mockReset();
    listAuditIssuesMock.mockReset();
    storeAuditIssuesMock.mockReset();
  });

  it("requires CLI auth", async () => {
    requireCliTokenMock.mockResolvedValue({ response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });

    const { GET } = await auditRoute;
    const res = await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1"));

    expect(res.status).toBe(401);
  });

  it("lists audit issues for a snapshot", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listAuditIssuesMock.mockResolvedValue([
      { id: "issue-1", snapshotId: "snap-1", ruleId: "rule-1", severity: "ERROR", path: "f1.txt", message: "msg" },
    ]);

    const { GET } = await auditRoute;
    const res = await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.issues).toHaveLength(1);
  });

  it("supports pagination for listing audit issues", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listAuditIssuesMock.mockResolvedValue([
      { id: "i1", ruleId: "r1" },
      { id: "i2", ruleId: "r2" },
    ]);

    const { GET } = await auditRoute;
    const res = await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1&limit=2"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.issues).toHaveLength(2);
    expect(json.nextCursor).toBe("i2");
    expect(listAuditIssuesMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 2,
      cursor: undefined,
    }));
  });

  it("clamps limit to max 500", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listAuditIssuesMock.mockResolvedValue([]);

    const { GET } = await auditRoute;
    await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1&limit=1000"));

    expect(listAuditIssuesMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 500,
    }));
  });

  it("clamps limit to min 1", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listAuditIssuesMock.mockResolvedValue([]);

    const { GET } = await auditRoute;
    await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1&limit=-10"));

    expect(listAuditIssuesMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 1,
    }));
  });

  it("returns null nextCursor when results < limit", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listAuditIssuesMock.mockResolvedValue([{ id: "i1", ruleId: "r1" }]);

    const { GET } = await auditRoute;
    const res = await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1&limit=10"));
    const json = await res.json();

    expect(json.nextCursor).toBeNull();
  });

  it("passes cursor parameter correctly", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listAuditIssuesMock.mockResolvedValue([]);

    const { GET } = await auditRoute;
    await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1&cursor=abc"));

    expect(listAuditIssuesMock).toHaveBeenCalledWith(expect.objectContaining({
      cursor: "abc",
    }));
  });

  it("propagates database errors", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    listAuditIssuesMock.mockRejectedValue(new Error("Database connection failed"));

    const { GET } = await auditRoute;
    await expect(GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1"))).rejects.toThrow("Database connection failed");
  });

  it("stores audit issues via POST", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    storeAuditIssuesMock.mockResolvedValue({ stored: 1 });

    const { POST } = await auditRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/audit", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: "snap-1",
          issues: [{ ruleId: "rule-1", severity: "ERROR", path: "f1.txt", message: "msg" }],
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.stored).toBe(1);
  });
});
