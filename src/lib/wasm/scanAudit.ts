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

export type GoRuntime = {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): void | Promise<void>;
};

export type ScanAuditFn = (request: WasmScanAuditRequest) => WasmScanAuditResponse;

export async function initMarkdowntownWasm(
  go: GoRuntime,
  wasmBytes: ArrayBuffer
): Promise<ScanAuditFn> {
  const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
  void go.run(instance);

  const fn = (globalThis as { markdowntownScanAudit?: (input: string) => unknown })
    .markdowntownScanAudit;
  if (typeof fn !== "function") {
    throw new Error("markdowntownScanAudit export not found");
  }

  return (request: WasmScanAuditRequest): WasmScanAuditResponse => {
    const payload = fn(JSON.stringify(request));
    const json = typeof payload === "string" ? payload : JSON.stringify(payload);
    return JSON.parse(json) as WasmScanAuditResponse;
  };
}

export async function loadMarkdowntownWasmFromUrl(
  go: GoRuntime,
  url: string
): Promise<ScanAuditFn> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
  }
  const bytes = await response.arrayBuffer();
  return initMarkdowntownWasm(go, bytes);
}

export async function loadMarkdowntownWasmFromFile(
  go: GoRuntime,
  filePath: string
): Promise<ScanAuditFn> {
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(filePath);
  return initMarkdowntownWasm(go, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
