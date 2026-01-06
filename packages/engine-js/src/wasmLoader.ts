import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

type GoInstance = {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): void | Promise<void>;
};

type GoConstructor = new () => GoInstance;

type GoGlobal = typeof globalThis & { Go?: GoConstructor };

type WasmGlobal = typeof globalThis & {
  markdowntownScanAudit?: (input: string) => unknown;
  markdowntownSuggest?: (input: string) => unknown;
};

export type WasmRegistry = {
  version: string;
  patterns: Array<Record<string, unknown>>;
};

export type WasmFileInput = {
  path: string;
  content: string;
};

export type WasmScanAuditRequest = {
  repoRoot?: string;
  files: WasmFileInput[];
  registry: WasmRegistry;
  includeContent?: boolean;
};

export type WasmScanAuditResponse = {
  ok: boolean;
  error?: string;
  output?: {
    scan: unknown;
    issues: unknown[];
  };
};

export type WasmSuggestRequest = {
  client: string;
  explain?: boolean;
  refresh?: boolean;
  offline?: boolean;
  proxyUrl?: string;
  registry: {
    version: string;
    allowlistHosts: string[];
    sources: Array<Record<string, unknown>>;
  };
  sourceOverrides?: Record<string, string>;
};

export type WasmSuggestResponse = {
  ok: boolean;
  error?: string;
  output?: unknown;
};

export type WasmEngine = {
  runScanAudit(request: WasmScanAuditRequest): WasmScanAuditResponse;
  runSuggest(request: WasmSuggestRequest): WasmSuggestResponse;
};

export type WasmEngineOptions = {
  wasmPath: string;
  wasmExecPath: string;
  cacheKey?: string;
};

const engineCache = new Map<string, Promise<WasmEngine>>();
const DEFAULT_CACHE_KEY = "markdowntown-engine";

export async function loadEngineWasm(options: WasmEngineOptions): Promise<WasmEngine> {
  const cacheKey = options.cacheKey ?? DEFAULT_CACHE_KEY;
  const existing = engineCache.get(cacheKey);
  if (existing) return existing;

  const loadPromise = initializeEngine(options).catch((error) => {
    engineCache.delete(cacheKey);
    throw error;
  });

  engineCache.set(cacheKey, loadPromise);
  return loadPromise;
}

async function initializeEngine(options: WasmEngineOptions): Promise<WasmEngine> {
  await import(pathToFileURL(options.wasmExecPath).href);
  const GoCtor = (globalThis as GoGlobal).Go;
  if (!GoCtor) {
    throw new Error(`Go runtime not found after loading ${options.wasmExecPath}`);
  }

  const go = new GoCtor();
  const wasmBytes = await fs.readFile(options.wasmPath);
  const { instance } = await WebAssembly.instantiate(toArrayBuffer(wasmBytes), go.importObject);
  void go.run(instance);

  const scanAudit = (globalThis as WasmGlobal).markdowntownScanAudit;
  if (typeof scanAudit !== "function") {
    throw new Error("markdowntownScanAudit export not found after initializing WASM");
  }

  const suggest = (globalThis as WasmGlobal).markdowntownSuggest;

  return {
    runScanAudit(request: WasmScanAuditRequest): WasmScanAuditResponse {
      const payload = scanAudit(JSON.stringify(request));
      const json = typeof payload === "string" ? payload : JSON.stringify(payload);
      const response = JSON.parse(json) as WasmScanAuditResponse;
      if (Array.isArray(response.output?.issues)) {
        response.output.issues = normalizeIssues(response.output.issues);
      }
      return response;
    },
    runSuggest(request: WasmSuggestRequest): WasmSuggestResponse {
      if (typeof suggest !== "function") {
        return { ok: false, error: "markdowntownSuggest export not found" };
      }
      const payload = suggest(JSON.stringify(request));
      const json = typeof payload === "string" ? payload : JSON.stringify(payload);
      return JSON.parse(json) as WasmSuggestResponse;
    },
  };
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const sliced = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (sliced instanceof SharedArrayBuffer) {
    // Convert SharedArrayBuffer to ArrayBuffer
    const ab = new ArrayBuffer(sliced.byteLength);
    new Uint8Array(ab).set(new Uint8Array(sliced));
    return ab;
  }
  return sliced;
}

function normalizeIssues(rawIssues: any[]): any[] {
  const severityRank: Record<string, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  const issues = (rawIssues ?? []).map((issue) => {
    const ruleId = String(issue?.ruleId ?? issue?.ruleID ?? "");
    const severity = String(issue?.severity ?? "");
    const paths = normalizePaths(issue?.paths ?? []);
    const tools = normalizeTools(issue?.tools ?? []);
    return {
      ...issue,
      ruleId,
      severity,
      paths,
      tools,
      fingerprint: fingerprintIssue({
        ...issue,
        ruleId,
        severity,
        paths,
        tools,
      }),
    };
  });

  issues.sort((left, right) => {
    const leftSeverity = severityRank[String(left?.severity ?? "").toLowerCase()] ?? 3;
    const rightSeverity = severityRank[String(right?.severity ?? "").toLowerCase()] ?? 3;
    if (leftSeverity !== rightSeverity) {
      return leftSeverity - rightSeverity;
    }
    const leftRule = String(left?.ruleId ?? left?.ruleID ?? "");
    const rightRule = String(right?.ruleId ?? right?.ruleID ?? "");
    if (leftRule !== rightRule) {
      return leftRule.localeCompare(rightRule);
    }
    const leftPrimaryPath = primaryPath(left?.paths ?? []);
    const rightPrimaryPath = primaryPath(right?.paths ?? []);
    if (leftPrimaryPath !== rightPrimaryPath) {
      return leftPrimaryPath.localeCompare(rightPrimaryPath);
    }
    const leftTool = primaryTool(left?.tools ?? []);
    const rightTool = primaryTool(right?.tools ?? []);
    if (leftTool !== rightTool) {
      return leftTool.localeCompare(rightTool);
    }
    return primaryKind(left?.tools ?? []).localeCompare(primaryKind(right?.tools ?? []));
  });

  return issues;
}

function normalizePaths(rawPaths: any[]) {
  const paths = (rawPaths ?? []).map((path) => ({
    path: String(path?.path ?? ""),
    scope: path?.scope ? String(path.scope) : "",
    pathId: path?.pathId ? String(path.pathId) : path?.pathID ? String(path.pathID) : "",
    redacted: Boolean(path?.redacted),
  }));

  paths.sort((left, right) => {
    if (left.path !== right.path) {
      return left.path.localeCompare(right.path);
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope);
    }
    return left.pathId.localeCompare(right.pathId);
  });

  return paths;
}

function normalizeTools(rawTools: any[]) {
  const tools = (rawTools ?? []).map((tool) => ({
    toolId: String(tool?.toolId ?? ""),
    kind: String(tool?.kind ?? ""),
  }));
  tools.sort((left, right) => {
    if (left.toolId !== right.toolId) {
      return left.toolId.localeCompare(right.toolId);
    }
    return left.kind.localeCompare(right.kind);
  });
  return tools;
}

function primaryPath(paths: any[]): string {
  if (!paths || paths.length === 0) return "";
  return String(paths[0]?.path ?? "");
}

function primaryTool(tools: any[]): string {
  if (!tools || tools.length === 0) return "";
  return String(tools[0]?.toolId ?? "");
}

function primaryKind(tools: any[]): string {
  if (!tools || tools.length === 0) return "";
  return String(tools[0]?.kind ?? "");
}

function fingerprintIssue(issue: any): string {
  const input = {
    ruleId: String(issue?.ruleId ?? issue?.ruleID ?? ""),
    severity: String(issue?.severity ?? ""),
    paths: fingerprintPaths(issue?.paths ?? []),
    tools: fingerprintTools(issue?.tools ?? []),
    evidence: fingerprintEvidence(issue?.evidence ?? {}),
  };

  const encoded = JSON.stringify(input);
  const hash = createHash("sha256").update(encoded).digest("hex");
  return `sha256:${hash}`;
}

function fingerprintPaths(paths: any[]) {
  const fp = (paths ?? []).map((path) => {
    const scope = String(path?.scope ?? "");
    const pathId = path?.pathId ? String(path.pathId) : path?.pathID ? String(path.pathID) : "";
    const value = String(path?.path ?? "");
    const key = scope !== "repo" && pathId ? pathId : value;
    const entry: { key: string; scope: string; id?: string } = { key, scope };
    if (pathId) {
      entry.id = pathId;
    }
    return entry;
  });

  fp.sort((left, right) => {
    if (left.key !== right.key) {
      return left.key.localeCompare(right.key);
    }
    return left.scope.localeCompare(right.scope);
  });

  return fp;
}

function fingerprintTools(tools: any[]) {
  const fp = (tools ?? []).map((tool) => ({
    toolId: String(tool?.toolId ?? ""),
    kind: String(tool?.kind ?? ""),
  }));

  fp.sort((left, right) => {
    if (left.toolId !== right.toolId) {
      return left.toolId.localeCompare(right.toolId);
    }
    return left.kind.localeCompare(right.kind);
  });

  return fp;
}

function fingerprintEvidence(evidence: any): any[] | undefined {
  if (!evidence || typeof evidence !== "object") {
    return undefined;
  }
  const keys = Object.keys(evidence).sort((left, right) => left.localeCompare(right));
  const pairs = keys.map((key) => ({
    key,
    value: evidence[key],
  }));
  return pairs.length > 0 ? pairs : undefined;
}
