import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

async function main() {
  const repoRoot = process.cwd();
  // Assume run from repo root or apps/web
  const wasmDir = repoRoot.endsWith("apps/web") 
    ? path.join(repoRoot, "public/engine")
    : path.join(repoRoot, "apps/web/public/engine");
  
  const wasmPath = path.join(wasmDir, "markdowntown_engine.wasm");
  const wasmExecPath = path.join(wasmDir, "wasm_exec.js");
  const registryPath = repoRoot.endsWith("apps/web")
    ? path.join(repoRoot, "../../cli/data/ai-config-patterns.json")
    : path.join(repoRoot, "cli/data/ai-config-patterns.json");

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
        content: "---\ntoolId: claude-3-opus\n---\n# Test\nYou MUST follow instructions.",
      },
    ],
  };

  const scanAudit = (globalThis as any).markdowntownScanAudit;
  
  const iterations = 100;
  console.log(`Benchmarking WASM engine (Preview path) over ${iterations} iterations...`);

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

  console.log(`Scan/Audit: Total time: ${totalMs.toFixed(2)}ms`);
  console.log(`Scan/Audit: Average time per call: ${avgMs.toFixed(2)}ms`);

  const sourcesPath = repoRoot.endsWith("apps/web")
    ? path.join(repoRoot, "../../cli/data/doc-sources.json")
    : path.join(repoRoot, "cli/data/doc-sources.json");
  const sourcesRegistry = JSON.parse(await fs.readFile(sourcesPath, "utf8"));
  const suggestRequest = {
    client: "codex",
    registry: sourcesRegistry,
    explain: true,
    offline: true, // Use offline mode for bench
  };

  const suggest = (globalThis as any).markdowntownSuggest;
  if (typeof suggest !== "function") {
    throw new Error("markdowntownSuggest export not available");
  }

  console.log(`Benchmarking WASM suggest (Preview path) over ${iterations} iterations...`);
  const suggestRequestStr = JSON.stringify(suggestRequest);
  const sStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const responseRaw = suggest(suggestRequestStr);
    const response = typeof responseRaw === "string" ? JSON.parse(responseRaw) : responseRaw;
    if (!response.ok) {
      throw new Error(response.error || "WASM suggest failed");
    }
  }
  const sEnd = performance.now();

  const sTotalMs = sEnd - sStart;
  const sAvgMs = sTotalMs / iterations;

  console.log(`Suggest: Total time: ${sTotalMs.toFixed(2)}ms`);
  console.log(`Suggest: Average time per call: ${sAvgMs.toFixed(2)}ms`);
}

main().catch(console.error);
