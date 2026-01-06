import { Worker } from "node:worker_threads";
import path from "node:path";
import fs from "node:fs/promises";

export type WasmAuditRequest = {
  files: Array<{ path: string; content: string }>;
  registry: unknown;
  includeContent?: boolean;
  timeoutMs?: number;
};

export type WasmAuditResponse = {
  ok: boolean;
  error?: string;
  response?: { output?: { issues?: unknown[] } };
};

/**
 * Runs the WASM audit in an isolated worker thread with a timeout.
 */
export async function runWasmAuditIsolated(req: WasmAuditRequest): Promise<WasmAuditResponse> {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const wasmDir = path.join(repoRoot, "cli", "dist", "wasm");
  const wasmPath = path.join(wasmDir, "markdowntown_scan_audit.wasm");
  const wasmExecPath = path.join(wasmDir, "wasm_exec.js");
  const workerPath = path.resolve(process.cwd(), "src/lib/cli/wasmWorker.ts");

  // Verify paths exist
  try {
    await fs.access(wasmPath);
    await fs.access(wasmExecPath);
  } catch {
    return { ok: false, error: "WASM engine assets missing. Run 'pnpm run wasm:build'." };
  }

  return new Promise((resolve) => {
    // We use tsx to run the TS worker if in dev, or node if compiled.
    // In Next.js, we might need a different approach if src/ is not available at runtime.
    // For now, assume we can spawn a worker from the TS file.
    const worker = new Worker(
      `
      require('tsx/register');
      require('${workerPath}');
      `,
      {
        eval: true,
        workerData: {
          files: req.files,
          registry: req.registry,
          wasmPath,
          wasmExecPath,
          repoRoot: "/repo",
          includeContent: req.includeContent ?? true,
        },
      }
    );

    const timeout = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: "Audit execution timed out" });
    }, req.timeoutMs ?? 10000);

    worker.on("message", (msg) => {
      clearTimeout(timeout);
      worker.terminate();
      resolve(msg);
    });

    worker.on("error", (err) => {
      clearTimeout(timeout);
      worker.terminate();
      resolve({ ok: false, error: err.message });
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        resolve({ ok: false, error: `Worker exited with code ${code}` });
      }
    });
  });
}
