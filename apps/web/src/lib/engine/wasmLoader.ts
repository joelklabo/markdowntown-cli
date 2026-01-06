import fs from "node:fs";
import path from "node:path";
import {
  loadEngineWasm as loadEngineWasmCore,
  type WasmEngine,
  type WasmScanAuditRequest,
  type WasmScanAuditResponse,
  type WasmSuggestRequest,
  type WasmSuggestResponse,
} from "@markdowntown/engine-js";

export type {
  WasmEngine,
  WasmScanAuditRequest,
  WasmScanAuditResponse,
  WasmSuggestRequest,
  WasmSuggestResponse,
};

const WASM_FILE = "markdowntown_engine.wasm";
const WASM_EXEC_FILE = "wasm_exec.js";

export async function loadEngineWasm(): Promise<WasmEngine> {
  const wasmPath = resolveExisting("engine WASM", candidatePaths(WASM_FILE));
  const wasmExecPath = resolveExisting("wasm_exec.js", candidatePaths(WASM_EXEC_FILE));

  return loadEngineWasmCore({
    wasmPath,
    wasmExecPath,
    cacheKey: "apps-web-engine",
  });
}

function candidatePaths(filename: string): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "public", "engine", filename),
    path.resolve(cwd, "..", "public", "engine", filename),
    path.resolve(cwd, "apps", "web", "public", "engine", filename),
    path.resolve(cwd, "..", "apps", "web", "public", "engine", filename),
    path.resolve(cwd, "..", "..", "apps", "web", "public", "engine", filename),
  ];
}

function resolveExisting(label: string, paths: string[]): string {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not locate ${label}; tried: ${paths.join(", ")}`);
}
