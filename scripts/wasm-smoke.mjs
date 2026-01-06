import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const wasmDir = path.join(repoRoot, "apps/web/public/engine");
const wasmPath = path.join(wasmDir, "markdowntown_engine.wasm");
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
      content: "---\ntoolId: claude-3-opus\n---\n# Test",
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
console.log(`WASM audit ok. Issues: ${issues.length}`);

const sourcesPath = path.join(repoRoot, "cli", "data", "doc-sources.json");
const sourcesRegistry = JSON.parse(await fs.readFile(sourcesPath, "utf8"));
const suggestRequest = {
  client: "codex",
  registry: sourcesRegistry,
  explain: true,
  offline: true,
};

const suggest = globalThis.markdowntownSuggest;
if (typeof suggest !== "function") {
  throw new Error("markdowntownSuggest export not available");
}

const sResponseRaw = suggest(JSON.stringify(suggestRequest));
const sResponse = typeof sResponseRaw === "string" ? JSON.parse(sResponseRaw) : sResponseRaw;
if (!sResponse.ok) {
  throw new Error(sResponse.error || "WASM suggest failed");
}

const suggestions = sResponse.output?.suggestions ?? [];
console.log(`WASM suggest ok. Suggestions: ${suggestions.length}`);

async function ensureFile(filePath, message) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(message);
  }
}
