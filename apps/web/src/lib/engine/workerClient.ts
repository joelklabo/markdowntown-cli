import type { RunType } from "@prisma/client";

const DEFAULT_TIMEOUT_MS = 30_000;

export type WorkerRunRequest = {
  id: string;
  type: Lowercase<RunType>;
  timeoutMs?: number;
} & Record<string, unknown>;

export type WorkerRunResponse = {
  id: string;
  type: Lowercase<RunType>;
  ok: boolean;
  durationMs?: number;
  audit?: { output?: unknown };
  suggest?: { output?: unknown };
  error?: { code?: string; message: string };
};

export function getWorkerTimeoutMs() {
  const raw = process.env.ENGINE_WORKER_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.trunc(parsed), 10 * 60_000);
}

export function getWorkerBaseUrl(): string {
  const value = process.env.ENGINE_WORKER_URL?.trim();
  if (!value) {
    throw new Error("ENGINE_WORKER_URL is not configured");
  }
  return value;
}

export async function runWorker(request: WorkerRunRequest): Promise<WorkerRunResponse> {
  const baseUrl = getWorkerBaseUrl();
  const timeoutMs = request.timeoutMs ?? getWorkerTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL("/run", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, timeoutMs }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as WorkerRunResponse | null;
    if (!response.ok) {
      return {
        id: request.id,
        type: request.type,
        ok: false,
        error: {
          code: "worker_http_error",
          message: payload?.error?.message ?? `Worker request failed (${response.status})`,
        },
      };
    }

    return payload ?? { id: request.id, type: request.type, ok: false, error: { message: "Worker returned no data" } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker request failed";
    return { id: request.id, type: request.type, ok: false, error: { code: "worker_unreachable", message } };
  } finally {
    clearTimeout(timeout);
  }
}
