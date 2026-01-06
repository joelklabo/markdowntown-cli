import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWasmAuditIsolated } from "@/lib/cli/wasmAudit";

const { MockWorker, workerListeners } = vi.hoisted(() => {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  class MockWorker {
    on = vi.fn((event, listener) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(listener);
    });
    terminate = vi.fn();
  }
  return { MockWorker, workerListeners: listeners };
});

vi.mock("node:worker_threads", () => {
  return {
    Worker: MockWorker,
    default: {
      Worker: MockWorker,
    },
  };
});

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(JSON.stringify({ patterns: [] })),
  },
}));

describe("wasm-audit", () => {
  beforeEach(() => {
    for (const key in workerListeners) {
      delete workerListeners[key];
    }
    vi.clearAllMocks();
  });

  it("handles successful worker response", async () => {
    const promise = runWasmAuditIsolated({
      files: [],
      registry: {},
    });

    // Wait a bit for worker to be instantiated
    await new Promise((r) => setTimeout(r, 10));

    // Trigger message
    const listeners = workerListeners["message"];
    if (listeners) {
      listeners.forEach((l) => l({ ok: true, response: { output: { issues: [] } } }));
    }

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.response?.output?.issues).toHaveLength(0);
  });

  it("handles worker timeout", async () => {
    vi.useFakeTimers();
    const promise = runWasmAuditIsolated({
      files: [],
      registry: {},
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(101);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Audit execution timed out");
    vi.useRealTimers();
  });
});