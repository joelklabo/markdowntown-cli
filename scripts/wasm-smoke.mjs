import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const wasmDir = path.join(repoRoot, "cli", "dist", "wasm");
const wasmPath = path.join(wasmDir, "markdowntown_scan_audit.wasm");
const wasmExecPath = path.join(wasmDir, "wasm_exec.js");
const registryPath = path.join(repoRoot, "cli", "data", "ai-config-patterns.json");

await ensureFile(wasmPath, "WASM binary missing. Run: pnpm run wasm:build");
await ensureFile(wasmExecPath, "wasm_exec.js missing. Run: pnpm run wasm:build");

await import(pathToFileURL(wasmExecPath).href);
const GoCtor = globalThis.Go;
if (!GoCtor) {
  throw new Error("Go runtime not found after loading wasm_exec.js");
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

const scanAudit = globalThis.markdowntownScanAudit;
if (typeof scanAudit !== "function") {
  throw new Error("markdowntownScanAudit export not available");
}

const responseRaw = scanAudit(JSON.stringify(request));
const response = typeof responseRaw === "string" ? JSON.parse(responseRaw) : responseRaw;
if (!response.ok) {
  throw new Error(response.error || "WASM scanAudit failed");
}

const issues = response.output?.issues ?? [];
console.log(`WASM smoke ok. Issues: ${issues.length}`);

async function ensureFile(filePath, message) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(message);
  }
}
