import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

async function main() {
  const repoRoot = process.cwd();
  const wasmDir = path.join(repoRoot, "apps/web/public/engine");
  const wasmPath = path.join(wasmDir, "markdowntown_engine.wasm");
  const wasmExecPath = path.join(wasmDir, "wasm_exec.js");
  const registryPath = path.join(repoRoot, "cli", "data", "ai-config-patterns.json");

  if (!await exists(wasmPath)) {
    console.error("WASM binary missing at", wasmPath);
    process.exit(1);
  }

  // Load Go WASM support
  // @ts-ignore
  await import(pathToFileURL(wasmExecPath).href);
  const GoCtor = (globalThis as any).Go;
  if (!GoCtor) {
    throw new Error("Go runtime not found");
  }

  const go = new GoCtor();
  const wasmBytes = await fs.readFile(wasmPath);
  const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
  void go.run(instance);

  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const request = {
    repoRoot: "/repo",
    includeContent: true,
    registry,
    files: [
      {
        path: "/repo/AGENTS.md",
        content: "---\nkey: value\ninvalid: [\n---\n",
      },
    ],
  };

  const scanAudit = (globalThis as any).markdowntownScanAudit;
  if (typeof scanAudit !== "function") {
    throw new Error("markdowntownScanAudit export not available");
  }

  const iterations = 100;
  console.log(`Benchmarking WASM engine over ${iterations} iterations...`);

  const requestStr = JSON.stringify(request);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const responseRaw = scanAudit(requestStr);
    const response = typeof responseRaw === "string" ? JSON.parse(responseRaw) : responseRaw;
    if (!response.ok) {
      throw new Error(response.error || "WASM scanAudit failed");
    }
  }
  const end = performance.now();

  const totalMs = end - start;
  const avgMs = totalMs / iterations;

  console.log(`Total time: ${totalMs.toFixed(2)}ms`);
  console.log(`Average time per call: ${avgMs.toFixed(2)}ms`);
}

async function exists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

main().catch(console.error);
