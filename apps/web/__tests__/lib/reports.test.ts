import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { logAbuseSignal, logAuditEvent } from "@/lib/reports";

function withTempCwd(cb: () => void) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mdt-reports-"));
  const spy = vi.spyOn(process, "cwd").mockReturnValue(tmp);
  try {
    cb();
  } finally {
    spy.mockRestore();
  }
  return tmp;
}

function readLastLogEntry(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length === 0 || !lines[lines.length - 1]) return null;
  return JSON.parse(lines[lines.length - 1]);
}

describe("logAbuseSignal", () => {
  it("creates log file and appends entry", () => {
    const tmp = withTempCwd(() => {
      logAbuseSignal({ reason: "spam", ip: "1.1.1.1", userId: "u1" });
    });

    const file = path.join(tmp, "logs", "abuse-signals.log");
    expect(fs.existsSync(file)).toBe(true);
    const contents = fs.readFileSync(file, "utf8").trim().split("\n");
    expect(contents).toHaveLength(1);
    const entry = JSON.parse(contents[0]);
    expect(entry.reason).toBe("spam");
    expect(entry.ip).toBe("1.1.1.1");
    expect(entry.userId).toBe("u1");
    expect(entry.at).toBeDefined();
  });

  it("sanitizes control characters in abuse signals", () => {
    const tmp = withTempCwd(() => {
      logAbuseSignal({
        ip: "192.168.1.1\n\r",
        userId: "user\x00-123",
        reason: "Rate\nlimit\rexceeded",
        traceId: "trace\n-456",
      });
    });

    const file = path.join(tmp, "logs", "abuse-signals.log");
    const entry = readLastLogEntry(file);
    expect(entry?.ip).toBe("192.168.1.1");
    expect(entry?.userId).toBe("user-123");
    expect(entry?.reason).toBe("Ratelimitexceeded");
    expect(entry?.traceId).toBe("trace-456");
  });
});

describe("logAuditEvent sanitization", () => {
  it("removes control characters from event names", () => {
    const tmp = withTempCwd(() => {
      logAuditEvent({
        event: "test_event\n\rwith\x00control",
        userId: "user-123",
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    expect(entry?.event).toBe("test_eventwithcontrol");
  });

  it("redacts sensitive keys in metadata", () => {
    const tmp = withTempCwd(() => {
      logAuditEvent({
        event: "upload_complete",
        userId: "user-123",
        metadata: {
          blobCount: 10,
          token: "secret-token-12345",
          apiKey: "secret-api-key",
          status: "success",
        },
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    const metadata = entry?.metadata as Record<string, unknown>;
    
    expect(metadata.blobCount).toBe(10);
    expect(metadata.status).toBe("success");
    expect(metadata.token).toBe("[REDACTED]");
    expect(metadata.apiKey).toBe("[REDACTED]");
  });

  it("filters non-allowlisted metadata keys", () => {
    const tmp = withTempCwd(() => {
      logAuditEvent({
        event: "test_event",
        userId: "user-123",
        metadata: {
          status: "ok",
          arbitraryField: "should not appear",
          customKey: "also excluded",
        },
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    const metadata = entry?.metadata as Record<string, unknown>;
    
    expect(metadata.status).toBe("ok");
    expect(metadata).not.toHaveProperty("arbitraryField");
    expect(metadata).not.toHaveProperty("customKey");
  });

  it("sanitizes string values to remove newlines", () => {
    const tmp = withTempCwd(() => {
      logAuditEvent({
        event: "cli_upload_blob",
        userId: "user-123",
        reason: "Magic\nnumber\rfailure",
        details: "Line1\nLine2\rLine3",
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    expect(entry?.reason).toBe("Magicnumberfailure");
    expect(entry?.details).toBe("Line1Line2Line3");
  });

  it("truncates long string values", () => {
    const tmp = withTempCwd(() => {
      const longString = "a".repeat(1000);
      logAuditEvent({
        event: "test_event",
        userId: "user-123",
        details: longString,
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    const details = entry?.details as string;
    expect(details.length).toBeLessThanOrEqual(503); // 500 + "..."
    expect(details.endsWith("...")).toBe(true);
  });

  it("handles complex metadata types", () => {
    const tmp = withTempCwd(() => {
      logAuditEvent({
        event: "test_event",
        userId: "user-123",
        metadata: {
          status: "ok",
          nested: { key: "value" },
          array: [1, 2, 3],
        },
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    const metadata = entry?.metadata as Record<string, unknown>;
    
    expect(metadata.status).toBe("ok");
    expect(metadata.nested).toBe("[COMPLEX]");
    expect(metadata.array).toBe("[COMPLEX]");
  });

  it("redacts password field in top-level event", () => {
    const tmp = withTempCwd(() => {
      logAuditEvent({
        event: "auth_attempt",
        userId: "user-123",
        password: "secret123",
        token: "bearer-token",
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    expect(entry?.password).toBe("[REDACTED]");
    expect(entry?.token).toBe("[REDACTED]");
  });

  it("preserves allowed numeric metadata", () => {
    const tmp = withTempCwd(() => {
      logAuditEvent({
        event: "test_event",
        userId: "user-123",
        metadata: {
          blobCount: 42,
          totalBytes: 1024,
          status: "complete",
        },
      });
    });

    const file = path.join(tmp, "logs", "cli-audit.log");
    const entry = readLastLogEntry(file);
    const metadata = entry?.metadata as Record<string, unknown>;
    
    expect(metadata.blobCount).toBe(42);
    expect(metadata.totalBytes).toBe(1024);
    expect(metadata.status).toBe("complete");
  });
});

