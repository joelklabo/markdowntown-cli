import { describe, expect, it } from 'vitest';
import { scanRepoTree, type FileSystemHandleLike, type FileSystemDirectoryHandleLike } from '@/lib/atlas/simulators/fsScan';

function file(name: string): FileSystemHandleLike {
  return { kind: 'file', name };
}

function dir(name: string, children: FileSystemHandleLike[]): FileSystemDirectoryHandleLike {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const child of children) {
        yield [child.name, child];
      }
    },
  };
}

describe('atlas/simulators/fsScan', () => {
  it('walks directories and returns repo-relative paths', async () => {
    const guardedFile = file('AGENTS.md');
    Object.defineProperty(guardedFile, 'getFile', {
      value: () => {
        throw new Error('should not read');
      },
    });

    const root = dir('repo', [
      guardedFile,
      dir('node_modules', [file('ignored.txt')]),
      dir('apps', [dir('web', [file('AGENTS.md')])]),
    ]);

    const result = await scanRepoTree(root, { ignoreDirs: ['node_modules'], includeOnly: [/AGENTS\.md$/] });

    expect(result.truncated).toBe(false);
    expect(result.totalFiles).toBe(2);
    expect(result.matchedFiles).toBe(2);
    expect(result.tree.files.map(f => f.path)).toEqual(['AGENTS.md', 'apps/web/AGENTS.md']);
    expect(result.tree.files.every(file => file.content === '')).toBe(true);
  });

  it('filters by includeOnly patterns and reports matched counts', async () => {
    const root = dir('repo', [
      file('AGENTS.md'),
      file('README.md'),
      dir('apps', [dir('web', [file('GEMINI.md')])]),
    ]);

    const result = await scanRepoTree(root, { ignoreDirs: [], includeOnly: [/AGENTS\.md$/, /GEMINI\.md$/] });

    expect(result.totalFiles).toBe(3);
    expect(result.matchedFiles).toBe(2);
    expect(result.tree.files.map(f => f.path)).toEqual(['AGENTS.md', 'apps/web/GEMINI.md']);
    expect(result.tree.files.every(file => file.content === '')).toBe(true);
  });

  it('stops scanning when maxFiles is reached', async () => {
    const root = dir('repo', [file('a.txt'), file('b.txt'), file('c.txt')]);
    const result = await scanRepoTree(root, { maxFiles: 2, ignoreDirs: [] });

    expect(result.truncated).toBe(true);
    expect(result.totalFiles).toBe(2);
    expect(result.matchedFiles).toBe(2);
    expect(result.tree.files).toHaveLength(2);
    expect(result.tree.files.every(file => file.content === '')).toBe(true);
  });

  it('reports progress at the configured interval', async () => {
    const root = dir('repo', [file('a.md'), file('b.md')]);
    const progress: Array<{ totalFiles: number; matchedFiles: number }> = [];

    const result = await scanRepoTree(root, {
      ignoreDirs: [],
      progressInterval: 1,
      onProgress: (snapshot) => progress.push({ ...snapshot }),
    });

    expect(result.totalFiles).toBe(2);
    expect(progress).toEqual([
      { totalFiles: 1, matchedFiles: 0 },
      { totalFiles: 2, matchedFiles: 1 },
      { totalFiles: 2, matchedFiles: 2 },
    ]);
  });

  it('marks binary instruction files as skipped when content is enabled', async () => {
    const binaryFile = file('AGENTS.md');
    Object.defineProperty(binaryFile, 'getFile', {
      value: async () => ({
        size: 4,
        text: async () => 'binary',
        arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer,
      }),
    });

    const root = dir('repo', [binaryFile]);
    const result = await scanRepoTree(root, { includeContent: true, includeOnly: [/AGENTS\.md$/], ignoreDirs: [] });

    expect(result.tree.files[0]?.contentStatus).toBe('skipped');
    expect(result.tree.files[0]?.contentReason).toBe('binary');
  });
});
