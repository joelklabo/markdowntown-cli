import path from 'node:path';
import { loadAtlasExample } from './load';
import type { AtlasPlatformId } from './types';

export type AtlasExampleSelection = {
  platformId: AtlasPlatformId;
  fileName: string;
};

export class AtlasExamplesZipError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AtlasExamplesZipError';
    this.status = status;
  }
}

export type CreateAtlasExamplesZipOptions = {
  atlasDir?: string;
  maxFiles?: number;
  maxTotalBytes?: number;
};

export type AtlasExamplesZipResult = {
  zip: Buffer;
  fileCount: number;
  totalBytes: number;
};

const DEFAULT_MAX_FILES = 25;
const DEFAULT_MAX_TOTAL_BYTES = 512 * 1024; // 512 KiB (uncompressed)

function assertSafeZipPath(entryPath: string): void {
  if (path.isAbsolute(entryPath)) {
    throw new AtlasExamplesZipError('Zip entries must not use absolute paths.', 400);
  }
  const normalized = entryPath.replace(/\\/g, '/');
  if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
    throw new AtlasExamplesZipError('Zip entries must not contain parent directory segments.', 400);
  }
}

function coerceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function createAtlasExamplesZip(
  selections: AtlasExampleSelection[],
  options?: CreateAtlasExamplesZipOptions,
): Promise<AtlasExamplesZipResult> {
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxTotalBytes = options?.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;

  if (!Array.isArray(selections) || selections.length === 0) {
    throw new AtlasExamplesZipError('No example files selected.', 400);
  }

  if (selections.length > maxFiles) {
    throw new AtlasExamplesZipError(`Too many files selected (max ${maxFiles}).`, 413);
  }

  const unique = new Map<string, AtlasExampleSelection>();
  for (const selection of selections) {
    const entryPath = path.posix.join(selection.platformId, selection.fileName);
    unique.set(entryPath, selection);
  }

  if (unique.size > maxFiles) {
    throw new AtlasExamplesZipError(`Too many files selected (max ${maxFiles}).`, 413);
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  let totalBytes = 0;

  for (const [entryPath, selection] of Array.from(unique.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    assertSafeZipPath(entryPath);

    let contents = '';
    try {
      contents = loadAtlasExample(selection.platformId, selection.fileName, { atlasDir: options?.atlasDir });
    } catch (error) {
      const message = coerceErrorMessage(error);
      if (message.includes('Invalid example filename')) {
        throw new AtlasExamplesZipError(message, 400);
      }
      throw new AtlasExamplesZipError(message, 404);
    }

    const bytes = Buffer.byteLength(contents, 'utf8');
    totalBytes += bytes;
    if (totalBytes > maxTotalBytes) {
      throw new AtlasExamplesZipError(`Selected files exceed size limit (${maxTotalBytes} bytes).`, 413);
    }

    zip.file(entryPath, contents);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { zip: zipBuffer, fileCount: unique.size, totalBytes };
}
