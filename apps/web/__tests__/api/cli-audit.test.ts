import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/rateLimiter";
import { MAX_AUDIT_ISSUES, MAX_AUDIT_MESSAGE_LENGTH, MAX_AUDIT_RULE_ID_LENGTH } from "@/lib/validation";

const { requireCliTokenMock, storeAuditIssuesMock, listAuditIssuesMock } = vi.hoisted(() => {
  return {
    requireCliTokenMock: vi.fn(),
    storeAuditIssuesMock: vi.fn(),
    listAuditIssuesMock: vi.fn(),
  };
});

vi.mock("@/lib/cli/upload", () => ({ requireCliToken: requireCliTokenMock }));
vi.mock("@/lib/prisma", () => ({ hasDatabaseEnv: true }));
vi.mock("@/lib/audit/store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/store")>("@/lib/audit/store");
  return {
    ...actual,
    storeAuditIssues: storeAuditIssuesMock,
    listAuditIssues: listAuditIssuesMock,
  };
});

const auditRoute = import("@/app/api/cli/audit/route");

describe("cli-audit API", () => {
  beforeEach(() => {
    resetRateLimitStore();
    requireCliTokenMock.mockReset();
    storeAuditIssuesMock.mockReset();
    listAuditIssuesMock.mockReset();
  });

  it("requires CLI auth", async () => {
    requireCliTokenMock.mockResolvedValue({ response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });

    const { GET } = await auditRoute;
    const res = await GET(new Request("http://localhost/api/cli/audit?snapshotId=snap-1"));

    expect(res.status).toBe(401);
  });

  it("stores valid audit issues", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    storeAuditIssuesMock.mockResolvedValue({ stored: 1 });

    const { POST } = await auditRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/audit", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: "snap-1",
          issues: [{
            ruleId: "MD001",
            severity: "ERROR",
            path: "README.md",
            message: "Test issue",
          }],
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.stored).toBe(1);
  });

  it("rejects oversized issue lists", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    
    // Create an array slightly larger than MAX_AUDIT_ISSUES
    const tooManyIssues = Array.from({ length: MAX_AUDIT_ISSUES + 1 }, () => ({
        ruleId: "MD001",
        severity: "ERROR",
        path: "README.md",
        message: "Test issue",
    }));

    const { POST } = await auditRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/audit", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: "snap-1",
          issues: tooManyIssues,
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid payload");
    expect(json.details[0].message).toMatch(/Too big/i);
  });

  it("rejects oversized rule IDs", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    
    const longRuleId = "a".repeat(MAX_AUDIT_RULE_ID_LENGTH + 1);

    const { POST } = await auditRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/audit", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: "snap-1",
          issues: [{
            ruleId: longRuleId,
            severity: "ERROR",
            path: "README.md",
            message: "Test issue",
          }],
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid payload");
    expect(json.details[0].message).toMatch(/Too big/i);
  });

  it("rejects oversized messages", async () => {
    requireCliTokenMock.mockResolvedValue({ token: { userId: "user-1", scopes: [] } });
    
    const longMessage = "a".repeat(MAX_AUDIT_MESSAGE_LENGTH + 1);

    const { POST } = await auditRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/audit", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: "snap-1",
          issues: [{
            ruleId: "MD001",
            severity: "ERROR",
            path: "README.md",
            message: longMessage,
          }],
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid payload");
    expect(json.details[0].message).toMatch(/Too big/i);
  });
});
