import JSZip, { type JSZipObject } from 'jszip';
import type { RepoScanResult, RepoTree, RepoTreeFile } from './types';
import { DEFAULT_IGNORE_DIRS } from './fsScan';
import {
  readInstructionContent,
  redactSensitivePath,
  type ContentScanOptions,
  DEFAULT_INSTRUCTION_ALLOWLIST,
  DEFAULT_MAX_CONTENT_BYTES,
} from './contentScan';

export type ZipScanOptions = {
  ignoreDirs?: string[];
  maxFiles?: number;
  maxCompressedBytes?: number;
  maxUncompressedBytes?: number;
  maxCompressionRatio?: number;
  includeOnly?: RegExp[];
  includeContent?: boolean;
  contentAllowlist?: RegExp[];
  maxContentBytes?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ZipScanProgress) => void;
  progressInterval?: number;
};

export type ZipScanProgress = {
  totalFiles: number;
  matchedFiles: number;
};

export type ZipScanErrorKind = 'oversize' | 'corrupt';

export class ZipScanError extends Error {
  kind: ZipScanErrorKind;

  constructor(kind: ZipScanErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const DEFAULT_MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_FILES = 10_000;
const DEFAULT_MAX_COMPRESSION_RATIO = 25;

type ZipEntry = JSZipObject;

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === '.') return '';
  return normalized;
}

function shouldInclude(path: string, includeOnly?: RegExp[]): boolean {
  if (!includeOnly || includeOnly.length === 0) return true;
  return includeOnly.some((pattern) => pattern.test(path));
}

function containsIgnoredDir(path: string, ignoreDirs: Set<string>): boolean {
  if (ignoreDirs.size === 0) return false;
  const segments = path.split('/');
  return segments.some((segment) => ignoreDirs.has(segment));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function entrySizes(entry: ZipEntry): { compressed: number; uncompressed: number } {
  const data = (entry as unknown as { _data?: { compressedSize?: number; uncompressedSize?: number } })._data;
  const compressed =
    typeof data?.compressedSize === 'number' && Number.isFinite(data.compressedSize) ? data.compressedSize : 0;
  const uncompressed =
    typeof data?.uncompressedSize === 'number' && Number.isFinite(data.uncompressedSize) ? data.uncompressedSize : 0;
  return { compressed, uncompressed };
}

export async function scanZipFile(file: File, options: ZipScanOptions = {}): Promise<RepoScanResult> {
  const maxCompressedBytes = options.maxCompressedBytes ?? DEFAULT_MAX_COMPRESSED_BYTES;
  const maxUncompressedBytes = options.maxUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxCompressionRatio = options.maxCompressionRatio ?? DEFAULT_MAX_COMPRESSION_RATIO;

  if (file.size > maxCompressedBytes) {
    throw new ZipScanError(
      'oversize',
      `ZIP is ${formatBytes(file.size)} and exceeds the ${formatBytes(maxCompressedBytes)} limit. Upload a smaller ZIP or scan a folder instead.`,
    );
  }

  if (options.signal?.aborted) {
    throw new DOMException('Scan aborted', 'AbortError');
  }

  let zip: JSZip;
  try {
    const buffer = await file.arrayBuffer();
    if (options.signal?.aborted) {
      throw new DOMException('Scan aborted', 'AbortError');
    }
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ZipScanError('corrupt', 'ZIP file could not be read. Re-export the archive and try again.');
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > maxFiles) {
    throw new ZipScanError(
      'oversize',
      `ZIP contains ${entries.length} files, which exceeds the ${maxFiles} file limit. Upload a smaller archive or scan a folder.`,
    );
  }

  const ignoreDirs = new Set(options.ignoreDirs ?? DEFAULT_IGNORE_DIRS);
  const includeOnly = options.includeOnly;
  const includeContent = options.includeContent ?? false;
  const signal = options.signal;
  const onProgress = options.onProgress;
  const progressInterval = options.progressInterval ?? 50;
  const contentOptions: ContentScanOptions = {
    allowlist: options.contentAllowlist ?? DEFAULT_INSTRUCTION_ALLOWLIST,
    maxBytes: options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES,
  };

  const out: RepoTreeFile[] = [];
  let totalFiles = 0;
  let matchedFiles = 0;
  let truncated = false;
  let totalUncompressed = 0;
  let totalCompressed = 0;

  for (const entry of entries) {
    if (signal?.aborted) {
      throw new DOMException('Scan aborted', 'AbortError');
    }

    const path = normalizePath(entry.name);
    if (!path) continue;
    if (containsIgnoredDir(path, ignoreDirs)) continue;

    totalFiles += 1;
    const sizes = entrySizes(entry);
    totalUncompressed += sizes.uncompressed;
    totalCompressed += sizes.compressed;

    if (totalFiles > maxFiles) {
      truncated = true;
      break;
    }
    if (totalUncompressed > maxUncompressedBytes) {
      throw new ZipScanError(
        'oversize',
        `ZIP expands to ${formatBytes(totalUncompressed)}, exceeding the ${formatBytes(maxUncompressedBytes)} limit. Upload a smaller archive or scan a folder.`,
      );
    }
    const ratioBase = totalCompressed > 0 ? totalCompressed : file.size;
    if (ratioBase > 0 && totalUncompressed / ratioBase > maxCompressionRatio) {
      throw new ZipScanError(
        'oversize',
        'ZIP compression ratio is unusually high and may be unsafe. Try a smaller ZIP or scan a folder.',
      );
    }

    if (onProgress && totalFiles % progressInterval === 0) {
      onProgress({ totalFiles, matchedFiles });
    }

    if (shouldInclude(path, includeOnly)) {
      let content = '';
      let contentStatus: RepoTreeFile['contentStatus'];
      let contentReason: RepoTreeFile['contentReason'];
      const displayPath = redactSensitivePath(path);
      if (includeContent) {
        const result = await readInstructionContent(
          path,
          async () => ({
            size: sizes.uncompressed || undefined,
            text: () => entry.async('string') as Promise<string>,
            arrayBuffer: () => entry.async('arraybuffer') as Promise<ArrayBuffer>,
          }),
          contentOptions,
        );
        if (result.content !== null) {
          content = result.content;
          contentStatus = result.truncated ? 'truncated' : 'loaded';
        } else if (result.skipped) {
          contentStatus = 'skipped';
          contentReason = result.reason;
        }
      }
      out.push({
        path,
        displayPath: displayPath !== path ? displayPath : undefined,
        content,
        contentStatus,
        contentReason,
      });
      matchedFiles += 1;
    }
  }

  const tree: RepoTree = {
    files: out,
  };

  if (onProgress) {
    onProgress({ totalFiles, matchedFiles });
  }
  return { tree, totalFiles, matchedFiles, truncated };
}
