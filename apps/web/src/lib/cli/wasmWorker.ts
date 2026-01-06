import { parentPort, workerData } from "node:worker_threads";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

interface Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

interface GlobalWithGo {
  Go: new () => Go;
  markdowntownScanAudit: (request: string) => string | object;
}

async function run() {
  if (!parentPort) return;

  try {
    const { files, registry, wasmPath, wasmExecPath, repoRoot, includeContent } = workerData;

    // Load Go WASM support
    // We use dynamic import with pathToFileURL to avoid webpack bundling issues for this worker-internal dependency
    await import(pathToFileURL(wasmExecPath).href);
    
    const GoCtor = (globalThis as unknown as GlobalWithGo).Go;
    if (!GoCtor) {
      throw new Error("Go runtime not found in worker");
    }

    const go = new GoCtor();
    const wasmBytes = await fs.readFile(wasmPath);
    const { instance } = await WebAssembly.instantiate(
      wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength),
      go.importObject
    );
    
    // Start the Go runtime
    void go.run(instance);

    const scanAudit = (globalThis as unknown as GlobalWithGo).markdowntownScanAudit;
    if (typeof scanAudit !== "function") {
      throw new Error("markdowntownScanAudit export not available in worker");
    }

    const request = {
      repoRoot,
      includeContent,
      registry,
      files: files.map((file: { path: string; content: string }) => ({
        path: `${repoRoot}/${file.path}`,
        content: file.content,
      })),
    };

    const responseRaw = scanAudit(JSON.stringify(request));
    const response = typeof responseRaw === "string" ? JSON.parse(responseRaw) : responseRaw;

    parentPort.postMessage({ ok: true, response });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

run().catch((err) => {
  parentPort?.postMessage({ ok: false, error: err.message });
});
