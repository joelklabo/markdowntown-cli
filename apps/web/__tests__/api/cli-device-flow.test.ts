import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  createDeviceCodePayload,
  generateUserCode,
  normalizeUserCode,
  DEVICE_CODE_TTL_MS,
  hashCode,
} from "@/lib/cli/deviceFlow";
import { DEFAULT_CLI_SCOPES, normalizeScopes } from "@/lib/cli/tokens";
import { resetRateLimitStore } from "@/lib/rateLimiter";

type DeviceCodeRecord = {
  id: string;
  deviceCodeHash: string;
  userCodeHash: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  userId?: string | null;
  clientId?: string | null;
  deviceName?: string | null;
  scopes: string[];
  intervalSeconds: number;
  expiresAt: Date;
  confirmedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const { deviceCodes, prismaMock, issueCliTokenMock, requireSessionMock } = vi.hoisted(() => {
  const deviceCodes: DeviceCodeRecord[] = [];
  const issueCliTokenMock = vi.fn();
  const requireSessionMock = vi.fn();

  const prismaMock = {
    cliDeviceCode: {
      create: vi.fn(async ({ data }: { data: Partial<DeviceCodeRecord> }) => {
        const record: DeviceCodeRecord = {
          id: `device-${deviceCodes.length + 1}`,
          deviceCodeHash: data.deviceCodeHash ?? "",
          userCodeHash: data.userCodeHash ?? "",
          status: (data.status as DeviceCodeRecord["status"]) ?? "PENDING",
          userId: data.userId ?? null,
          clientId: data.clientId ?? null,
          deviceName: data.deviceName ?? null,
          scopes: data.scopes ?? [],
          intervalSeconds: data.intervalSeconds ?? 5,
          expiresAt: data.expiresAt ?? new Date(Date.now() + 60_000),
          confirmedAt: data.confirmedAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        deviceCodes.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: { where: { deviceCodeHash?: string; userCodeHash?: string } }) => {
        return (
          deviceCodes.find((record) => {
            if (where.deviceCodeHash && record.deviceCodeHash !== where.deviceCodeHash) return false;
            if (where.userCodeHash && record.userCodeHash !== where.userCodeHash) return false;
            return true;
          }) ?? null
        );
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<DeviceCodeRecord> }) => {
        const index = deviceCodes.findIndex((record) => record.id === where.id);
        if (index === -1) throw new Error("Device code not found");
        deviceCodes[index] = {
          ...deviceCodes[index],
          ...data,
          updatedAt: new Date(),
        } as DeviceCodeRecord;
        return deviceCodes[index];
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; status?: string }; data: Partial<DeviceCodeRecord> }) => {
        // Find first matching record where status matches (if specified)
        const index = deviceCodes.findIndex((item) => item.id === where.id && (!where.status || item.status === where.status));
        if (index === -1) return { count: 0 };
        // Update and return immediately before other concurrent calls can see it
        const updated = { ...deviceCodes[index], ...data, updatedAt: new Date() } as DeviceCodeRecord;
        deviceCodes[index] = updated;
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)),
  };

  return { deviceCodes, prismaMock, issueCliTokenMock, requireSessionMock };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, hasDatabaseEnv: true }));
vi.mock("@/lib/requireSession", () => ({ requireSession: requireSessionMock }));
vi.mock("@/lib/cli/tokens", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cli/tokens")>("@/lib/cli/tokens");
  return { ...actual, issueCliToken: issueCliTokenMock };
});
vi.mock("@/lib/csrf", () => ({
  generateCsrfToken: (userId: string) => `csrf-${userId}`,
  verifyCsrfToken: (userId: string, token: string) => token === `csrf-${userId}`,
}));

const deviceStartRoute = import("@/app/api/cli/device/start/route");
const devicePollRoute = import("@/app/api/cli/device/poll/route");
const deviceConfirmRoute = import("@/app/api/cli/device/confirm/route");

function seedDeviceCode(overrides: Partial<DeviceCodeRecord>) {
  const record: DeviceCodeRecord = {
    id: `device-${deviceCodes.length + 1}`,
    deviceCodeHash: overrides.deviceCodeHash ?? hashCode("device-code"),
    userCodeHash: overrides.userCodeHash ?? hashCode("USERCODE"),
    status: overrides.status ?? "PENDING",
    userId: overrides.userId ?? null,
    clientId: overrides.clientId ?? null,
    deviceName: overrides.deviceName ?? null,
    scopes: overrides.scopes ?? ["cli:read"],
    intervalSeconds: overrides.intervalSeconds ?? 5,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
    confirmedAt: overrides.confirmedAt ?? null,
    createdAt: new Date(),
    updatedAt: overrides.updatedAt ?? new Date(Date.now() - 60_000),
  };
  deviceCodes.push(record);
  return record;
}

describe("cli-device-flow", () => {
  it("normalizes user codes to alphanumeric uppercase", () => {
    expect(normalizeUserCode("ab-cd ef")).toBe("ABCDEF");
  });

  it("generates a user code with the expected format", () => {
    const code = generateUserCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it("creates a device code payload with a deterministic TTL", () => {
    vi.useFakeTimers();
    const now = new Date("2026-01-04T00:00:00Z");
    vi.setSystemTime(now);

    const payload = createDeviceCodePayload();
    expect(payload.expiresAt.getTime()).toBe(now.getTime() + DEVICE_CODE_TTL_MS);

    vi.useRealTimers();
  });
});

describe("cli-device-flow scopes", () => {
  it("defaults to the base scope set", () => {
    expect(normalizeScopes(undefined).scopes).toEqual(DEFAULT_CLI_SCOPES);
  });

  it("normalizes and orders scopes deterministically", () => {
    const result = normalizeScopes(["cli:patch", "cli:upload", "cli:patch"]);
    expect(result.scopes).toEqual(["cli:upload", "cli:patch"]);
  });

  it("rejects unknown scopes", () => {
    const result = normalizeScopes(["cli:upload", "cli:unknown"]);
    expect(result.error).toBeDefined();
  });
});

describe("cli-device-flow API", () => {
  beforeEach(() => {
    deviceCodes.length = 0;
    resetRateLimitStore();
    issueCliTokenMock.mockReset();
    requireSessionMock.mockReset();
  });

  it("creates device codes via start", async () => {
    const { POST } = await deviceStartRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/start", {
        method: "POST",
        body: JSON.stringify({ clientId: "cli", scopes: ["cli:read"] }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.device_code).toBeDefined();
    expect(json.user_code).toBeDefined();
    expect(deviceCodes).toHaveLength(1);
  });

  it("rejects invalid scopes in start", async () => {
    const { POST } = await deviceStartRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/start", {
        method: "POST",
        body: JSON.stringify({ scopes: ["cli:unknown"] }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns invalid_device_code on poll when missing", async () => {
    const { POST } = await devicePollRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: "missing" }),
      })
    );

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("invalid_device_code");
  });

  it("issues tokens when device code approved", async () => {
    const deviceCode = "device-code-123";
    seedDeviceCode({
      deviceCodeHash: hashCode(deviceCode),
      status: "APPROVED",
      userId: "user-1",
    });

    issueCliTokenMock.mockResolvedValue({
      token: "token-1",
      tokenId: "token-id",
      scopes: ["cli:read"],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { POST } = await devicePollRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: deviceCode }),
      })
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.access_token).toBe("token-1");
  });

  it("throttles rapid polling with slow_down", async () => {
    const deviceCode = "device-code-rapid";
    seedDeviceCode({
      deviceCodeHash: hashCode(deviceCode),
      intervalSeconds: 10,
      updatedAt: new Date(),
    });

    const { POST } = await devicePollRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: deviceCode }),
      })
    );

    const json = await res.json();
    expect(res.status).toBe(429);
    expect(json.error).toBe("slow_down");
  });

  it("increases slow_down interval on repeated violations", async () => {
    const deviceCode = "device-code-slow";
    const initialInterval = 5;
    seedDeviceCode({
      deviceCodeHash: hashCode(deviceCode),
      intervalSeconds: initialInterval,
      updatedAt: new Date(),
    });

    const { POST } = await devicePollRoute;
    
    // First rapid poll - interval should increase from 5 to 10
    const res1 = await POST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: deviceCode }),
      })
    );
    
    const json1 = await res1.json();
    expect(res1.status).toBe(429);
    expect(json1.error).toBe("slow_down");
    expect(json1.interval).toBe(10);
    
    // Second rapid poll - interval should increase from 10 to 15
    const res2 = await POST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: deviceCode }),
      })
    );
    
    const json2 = await res2.json();
    expect(res2.status).toBe(429);
    expect(json2.error).toBe("slow_down");
    expect(json2.interval).toBe(15);
  });

  it("returns access_denied for denied device codes", async () => {
    const deviceCode = "device-code-denied";
    seedDeviceCode({
      deviceCodeHash: hashCode(deviceCode),
      status: "DENIED",
    });

    const { POST } = await devicePollRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: deviceCode }),
      })
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("access_denied");
  });

  it("returns expired_token for expired device codes on poll", async () => {
    const deviceCode = "device-code-expired";
    seedDeviceCode({
      deviceCodeHash: hashCode(deviceCode),
      expiresAt: new Date(Date.now() - 1000),
    });

    const { POST } = await devicePollRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: deviceCode }),
      })
    );

    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error).toBe("expired_token");
    
    // Verify status was updated to EXPIRED
    const record = deviceCodes.find(r => r.deviceCodeHash === hashCode(deviceCode));
    expect(record?.status).toBe("EXPIRED");
  });

  it("issues single token for concurrent poll requests", async () => {
    const deviceCode = "device-code-concurrent";
    seedDeviceCode({
      deviceCodeHash: hashCode(deviceCode),
      status: "APPROVED",
      userId: "user-1",
    });

    issueCliTokenMock.mockResolvedValue({
      token: "concurrent-token",
      tokenId: "token-concurrent",
      scopes: ["cli:read"],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { POST } = await devicePollRoute;
    
    // Simulate concurrent requests
    const [res1, res2, res3] = await Promise.all([
      POST(
        new Request("http://localhost/api/cli/device/poll", {
          method: "POST",
          body: JSON.stringify({ device_code: deviceCode }),
        })
      ),
      POST(
        new Request("http://localhost/api/cli/device/poll", {
          method: "POST",
          body: JSON.stringify({ device_code: deviceCode }),
        })
      ),
      POST(
        new Request("http://localhost/api/cli/device/poll", {
          method: "POST",
          body: JSON.stringify({ device_code: deviceCode }),
        })
      ),
    ]);

    const json1 = await res1.json();
    const json2 = await res2.json();
    const json3 = await res3.json();

    // One should succeed with token, others should get authorization_pending
    const responses = [
      { status: res1.status, json: json1 },
      { status: res2.status, json: json2 },
      { status: res3.status, json: json3 },
    ];

    const successCount = responses.filter(r => r.status === 200 && r.json.access_token).length;
    const pendingCount = responses.filter(r => r.status === 400 && r.json.error === "authorization_pending").length;
    const expiredCount = responses.filter(r => r.status === 410 && r.json.error === "expired_token").length;

    expect(successCount).toBe(1);
    // Other two requests either get pending (before update) or expired (after update)
    expect(pendingCount + expiredCount).toBe(2);
    
    // Verify issueCliToken was called only once
    expect(issueCliTokenMock).toHaveBeenCalledTimes(1);
    
    // Verify device code status is now EXPIRED
    const record = deviceCodes.find(r => r.deviceCodeHash === hashCode(deviceCode));
    expect(record?.status).toBe("EXPIRED");
  });

  it("allows approval right before expiration", async () => {
    const userCode = generateUserCode();
    const normalized = normalizeUserCode(userCode) ?? userCode;
    const deviceCode = "device-code-last-second";
    
    // Set expiration to 1 second from now
    seedDeviceCode({
      deviceCodeHash: hashCode(deviceCode),
      userCodeHash: hashCode(normalized),
      expiresAt: new Date(Date.now() + 1000),
    });

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: undefined,
    });

    // Approve the code
    const { POST: confirmPOST } = await deviceConfirmRoute;
    const confirmRes = await confirmPOST(
      new Request("http://localhost/api/cli/device/confirm", {
        method: "POST",
        body: JSON.stringify({ user_code: userCode, approved: true, csrf_token: "csrf-user-1" }),
      })
    );

    expect(confirmRes.status).toBe(200);
    const confirmJson = await confirmRes.json();
    expect(confirmJson.status).toBe("approved");

    // Poll immediately - should issue token
    issueCliTokenMock.mockResolvedValue({
      token: "last-second-token",
      tokenId: "token-last-second",
      scopes: ["cli:read"],
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { POST: pollPOST } = await devicePollRoute;
    const pollRes = await pollPOST(
      new Request("http://localhost/api/cli/device/poll", {
        method: "POST",
        body: JSON.stringify({ device_code: deviceCode }),
      })
    );

    expect(pollRes.status).toBe(200);
    const pollJson = await pollRes.json();
    expect(pollJson.access_token).toBe("last-second-token");
  });

  it("requires session for confirm", async () => {
    requireSessionMock.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const { POST } = await deviceConfirmRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/confirm", {
        method: "POST",
        body: JSON.stringify({ user_code: "ABCD-EFGH", approved: true }),
      })
    );

    expect(res.status).toBe(401);
  });

  it("confirms device codes for sessions", async () => {
    const userCode = generateUserCode();
    const normalized = normalizeUserCode(userCode) ?? userCode;
    seedDeviceCode({ userCodeHash: hashCode(normalized) });

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: undefined,
    });

    const { POST } = await deviceConfirmRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/confirm", {
        method: "POST",
        body: JSON.stringify({ user_code: userCode, approved: true, csrf_token: "csrf-user-1" }),
      })
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("approved");
  });

  it("rejects missing CSRF token", async () => {
    const userCode = generateUserCode();
    const normalized = normalizeUserCode(userCode) ?? userCode;
    seedDeviceCode({ userCodeHash: hashCode(normalized) });

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: undefined,
    });

    const { POST } = await deviceConfirmRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/confirm", {
        method: "POST",
        body: JSON.stringify({ user_code: userCode, approved: true }),
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid payload");
  });

  it("rejects invalid CSRF token", async () => {
    const userCode = generateUserCode();
    const normalized = normalizeUserCode(userCode) ?? userCode;
    seedDeviceCode({ userCodeHash: hashCode(normalized) });

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: undefined,
    });

    const { POST } = await deviceConfirmRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/confirm", {
        method: "POST",
        body: JSON.stringify({ user_code: userCode, approved: true, csrf_token: "invalid-token" }),
      })
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Invalid CSRF token");
  });

  it("rate-limits user code submission attempts", async () => {
    const userCode = generateUserCode();
    const normalized = normalizeUserCode(userCode) ?? userCode;
    seedDeviceCode({ userCodeHash: hashCode(normalized) });

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: undefined,
    });

    const { POST } = await deviceConfirmRoute;
    
    // Make 6 requests (limit is 5 per 60s for per-code rate limit)
    for (let i = 0; i < 6; i++) {
      const res = await POST(
        new Request("http://localhost/api/cli/device/confirm", {
          method: "POST",
          body: JSON.stringify({ user_code: userCode, approved: true, csrf_token: "csrf-user-1" }),
        })
      );
      
      if (i < 5) {
        expect(res.status).not.toBe(429);
      } else {
        expect(res.status).toBe(429);
        const json = await res.json();
        expect(json.error).toBe("Too many attempts for this code");
      }
    }
  });

  it("allows idempotent re-confirmation of already approved codes", async () => {
    const userCode = generateUserCode();
    const normalized = normalizeUserCode(userCode) ?? userCode;
    seedDeviceCode({
      userCodeHash: hashCode(normalized),
      status: "APPROVED",
      userId: "user-1",
    });

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: undefined,
    });

    const { POST } = await deviceConfirmRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/confirm", {
        method: "POST",
        body: JSON.stringify({ user_code: userCode, approved: true, csrf_token: "csrf-user-1" }),
      })
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("approved");
  });

  it("returns expired_token for expired device codes", async () => {
    const userCode = generateUserCode();
    const normalized = normalizeUserCode(userCode) ?? userCode;
    seedDeviceCode({
      userCodeHash: hashCode(normalized),
      expiresAt: new Date(Date.now() - 1000),
    });

    requireSessionMock.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: undefined,
    });

    const { POST } = await deviceConfirmRoute;
    const res = await POST(
      new Request("http://localhost/api/cli/device/confirm", {
        method: "POST",
        body: JSON.stringify({ user_code: userCode, approved: true, csrf_token: "csrf-user-1" }),
      })
    );

    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error).toBe("expired_token");
  });
});
