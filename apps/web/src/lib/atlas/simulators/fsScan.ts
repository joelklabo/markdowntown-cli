import type { RepoTree, RepoTreeFile } from './types.ts';
import {
  readInstructionContent,
  redactSensitivePath,
  type ContentScanOptions,
  DEFAULT_INSTRUCTION_ALLOWLIST,
  DEFAULT_MAX_CONTENT_BYTES,
} from './contentScan.ts';

export type FileSystemHandleLike = {
  kind: 'file' | 'directory';
  name: string;
};

export type FileSystemFileHandleLike = FileSystemHandleLike & {
  kind: 'file';
  getFile?: () => Promise<{ size?: number; text: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer> }>;
};

export type FileSystemDirectoryHandleLike = FileSystemHandleLike & {
  kind: 'directory';
  entries: () => AsyncIterable<[string, FileSystemHandleLike]>;
};

export type FsScanOptions = {
  ignoreDirs?: string[];
  maxFiles?: number;
  includeOnly?: RegExp[];
  includeContent?: boolean;
  contentAllowlist?: RegExp[];
  maxContentBytes?: number;
  signal?: AbortSignal;
  onProgress?: (progress: { totalFiles: number; matchedFiles: number }) => void;
  progressInterval?: number;
};

export type FsScanResult = {
  tree: RepoTree;
  totalFiles: number;
  matchedFiles: number;
  truncated: boolean;
};

export const DEFAULT_IGNORE_DIRS = [
  '.git',
  '.next',
  '.beads',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test-results',
];

export const DEFAULT_MAX_FILES = 5000;

function joinPath(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}

async function walk(
  dir: FileSystemDirectoryHandleLike,
  prefix: string,
  ignoreDirs: Set<string>,
  maxFiles: number,
  includeOnly: RegExp[] | undefined,
  includeContent: boolean,
  contentOptions: ContentScanOptions,
  signal: AbortSignal | undefined,
  onProgress: FsScanOptions['onProgress'],
  progressInterval: number,
  out: RepoTreeFile[],
): Promise<{ totalFiles: number; matchedFiles: number; truncated: boolean }> {
  let totalFiles = 0;
  let matchedFiles = 0;

  for await (const [name, handle] of dir.entries()) {
    if (signal?.aborted) {
      throw new DOMException('Scan aborted', 'AbortError');
    }
    if (totalFiles >= maxFiles) {
      return { totalFiles, matchedFiles, truncated: true };
    }

    if (!handle || typeof handle.kind !== 'string') continue;

    if (handle.kind === 'directory') {
      if (ignoreDirs.has(name)) continue;
      const nextPrefix = joinPath(prefix, name);
      const result = await walk(
        handle as FileSystemDirectoryHandleLike,
        nextPrefix,
        ignoreDirs,
        maxFiles,
        includeOnly,
        includeContent,
        contentOptions,
        signal,
        onProgress,
        progressInterval,
        out,
      );
      totalFiles += result.totalFiles;
      matchedFiles += result.matchedFiles;
      if (result.truncated) return { totalFiles, matchedFiles, truncated: true };
      continue;
    }

    if (handle.kind === 'file') {
      // Guardrail: read contents only when opted-in and allowlisted.
      totalFiles += 1;
      if (onProgress && totalFiles % progressInterval === 0) {
        onProgress({ totalFiles, matchedFiles });
      }
      const path = joinPath(prefix, name);
      const displayPath = redactSensitivePath(path);
      if (!includeOnly || includeOnly.some((pattern) => pattern.test(path))) {
        let content = '';
        let contentStatus: RepoTreeFile['contentStatus'];
        let contentReason: RepoTreeFile['contentReason'];
        if (includeContent) {
          const fileHandle = handle as FileSystemFileHandleLike;
          if (typeof fileHandle.getFile === 'function') {
            const result = await readInstructionContent(path, () => fileHandle.getFile!(), contentOptions);
            if (result.content !== null) {
              content = result.content;
              contentStatus = result.truncated ? 'truncated' : 'loaded';
            } else if (result.skipped) {
              contentStatus = 'skipped';
              contentReason = result.reason;
            }
          } else {
            contentStatus = 'skipped';
            contentReason = 'unreadable';
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
  }

  if (onProgress) {
    onProgress({ totalFiles, matchedFiles });
  }
  return { totalFiles, matchedFiles, truncated: false };
}

export async function scanRepoTree(
  root: FileSystemDirectoryHandleLike,
  options: FsScanOptions = {},
): Promise<FsScanResult> {
  const ignoreDirs = new Set(options.ignoreDirs ?? DEFAULT_IGNORE_DIRS);
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const includeOnly = options.includeOnly;
  const includeContent = options.includeContent ?? false;
  const signal = options.signal;
  const onProgress = options.onProgress;
  const progressInterval = options.progressInterval ?? 50;
  const contentOptions: ContentScanOptions = {
    allowlist: options.contentAllowlist ?? DEFAULT_INSTRUCTION_ALLOWLIST,
    maxBytes: options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES,
  };
  const files: RepoTreeFile[] = [];

  const { totalFiles, matchedFiles, truncated } = await walk(
    root,
    '',
    ignoreDirs,
    maxFiles,
    includeOnly,
    includeContent,
    contentOptions,
    signal,
    onProgress,
    progressInterval,
    files,
  );

  const tree: RepoTree = {
    files,
  };

  return { tree, totalFiles, matchedFiles, truncated };
}
