import type { CompiledFile } from '../adapters/types';
import { assertSafeZipEntryPath } from './pathSafety';

export interface ZipOptions {
  maxFiles?: number;
  maxTotalBytes?: number;
}

const DEFAULT_MAX_FILES = 200;
const DEFAULT_MAX_TOTAL_BYTES = 2_000_000;

export async function createZip(files: CompiledFile[], options: ZipOptions = {}): Promise<Blob> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;

  if (files.length > maxFiles) {
    throw new Error(`Too many files to zip: ${files.length} (max ${maxFiles})`);
  }

  const encoder = new TextEncoder();
  const totalBytes = files.reduce((sum, f) => sum + encoder.encode(f.content).byteLength, 0);
  if (totalBytes > maxTotalBytes) {
    throw new Error(`Zip contents too large: ${totalBytes} bytes (max ${maxTotalBytes})`);
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const seenPaths = new Set<string>();

  for (const file of files) {
    const safePath = assertSafeZipEntryPath(file.path);
    if (seenPaths.has(safePath)) {
      throw new Error(`Duplicate file path in zip: ${safePath}`);
    }
    seenPaths.add(safePath);
    zip.file(safePath, file.content);
  }

  return await zip.generateAsync({ type: 'blob' });
}
