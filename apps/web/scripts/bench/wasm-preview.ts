import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

// Define the shape of the Go Wasm object for better type safety
type GoInstance = {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): void | Promise<void>;
};

// Define the shape of the global Go constructor
type GoConstructor = new () => GoInstance;

// Define the shape of the Wasm module exports
type WasmGlobalExports = typeof globalThis & {
  markdowntownScanAudit?: (input: string) => unknown;
  markdowntownSuggest?: (input: string) => unknown;
};

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
  // @ts-expect-error Go is dynamically attached to globalThis by wasm_exec.js
  await import(pathToFileURL(wasmExecPath).href);
  const GoCtor = (globalThis as { Go?: GoConstructor }).Go;
  if (!GoCtor) {
    throw new Error("Go runtime not found");
  }

  const go = new GoCtor();
  const wasmBytes = await fs.readFile(wasmPath);
  const { instance } = await WebAssembly.instantiate(toArrayBuffer(wasmBytes), go.importObject);
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

  const scanAudit = (globalThis as WasmGlobalExports).markdowntownScanAudit;
  if (typeof scanAudit !== "function") {
    throw new Error("markdowntownScanAudit export not available");
  }
  
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
    sourceOverrides: {
      "https://example.com/docs.md": "You MUST do the thing.",
    },
  };

  const suggest = (globalThis as WasmGlobalExports).markdowntownSuggest;
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

// Helper to convert Buffer to ArrayBuffer for WebAssembly.instantiate
function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  // slice creates a new Buffer that does not share memory with the original,
  // then access its underlying ArrayBuffer.
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

main().catch(console.error);
