import { scanFileList, type FileListScanOptions } from "../fileListScan";
import type { RepoScanResult } from "../types";
import { parseRepoInput, type RepoPathParseResult } from "../treeParse";
import { scanZipFile, ZipScanError, type ZipScanOptions } from "../zipScan";

export type ScanWorkerRequest =
  | {
      id: number;
      type: "parse_tree";
      text: string;
    }
  | {
      id: number;
      type: "scan_zip";
      file: File;
      options?: ZipScanOptions;
    }
  | {
      id: number;
      type: "scan_file_list";
      files: File[];
      options?: FileListScanOptions;
    };

export type ScanWorkerResponse =
  | {
      id: number;
      type: "parse_tree_result";
      result: RepoPathParseResult;
    }
  | {
      id: number;
      type: "scan_result";
      origin: "zip" | "file_list";
      result: RepoScanResult;
    }
  | {
      id: number;
      type: "scan_progress";
      origin: "zip" | "file_list";
      progress: { totalFiles: number; matchedFiles: number };
    }
  | {
      id: number;
      type: "scan_error";
      origin: "zip" | "file_list" | "parse_tree";
      error: SerializedError;
    };

export type SerializedError = {
  name?: string;
  message: string;
  kind?: string;
};

export async function handleScanWorkerRequest(
  request: ScanWorkerRequest,
  postMessage: (response: ScanWorkerResponse) => void,
): Promise<void> {
  switch (request.type) {
    case "parse_tree": {
      const result = parseRepoInput(request.text);
      postMessage({ id: request.id, type: "parse_tree_result", result });
      return;
    }
    case "scan_zip": {
      try {
        const result = await scanZipFile(request.file, {
          ...(request.options ?? {}),
          onProgress: (progress) => {
            postMessage({
              id: request.id,
              type: "scan_progress",
              origin: "zip",
              progress,
            });
          },
        });
        postMessage({ id: request.id, type: "scan_result", origin: "zip", result });
      } catch (error) {
        postMessage({
          id: request.id,
          type: "scan_error",
          origin: "zip",
          error: serializeError(error),
        });
      }
      return;
    }
    case "scan_file_list": {
      try {
        const result = await scanFileList(request.files, {
          ...(request.options ?? {}),
          onProgress: (progress) => {
            postMessage({
              id: request.id,
              type: "scan_progress",
              origin: "file_list",
              progress,
            });
          },
        });
        postMessage({ id: request.id, type: "scan_result", origin: "file_list", result });
      } catch (error) {
        postMessage({
          id: request.id,
          type: "scan_error",
          origin: "file_list",
          error: serializeError(error),
        });
      }
      return;
    }
    default: {
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof ZipScanError) {
    return { name: error.name, message: error.message, kind: error.kind };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: "Unknown worker error" };
}

const workerScope =
  typeof self !== "undefined"
    ? (self as unknown as {
        postMessage: (message: ScanWorkerResponse) => void;
        onmessage: ((event: MessageEvent<ScanWorkerRequest>) => void) | null;
      })
    : null;
if (workerScope) {
  workerScope.onmessage = async (event: MessageEvent<ScanWorkerRequest>) => {
    const message = event.data as ScanWorkerRequest;
    await handleScanWorkerRequest(message, (response) => workerScope.postMessage(response));
  };
}
