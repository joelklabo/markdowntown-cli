import { describe, it, expect, vi } from "vitest";
import {
  createDeviceCodePayload,
  generateUserCode,
  normalizeUserCode,
  DEVICE_CODE_TTL_MS,
} from "@/lib/cli/deviceFlow";
import { DEFAULT_CLI_SCOPES, normalizeScopes } from "@/lib/cli/tokens";

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
