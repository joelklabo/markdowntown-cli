import { describe, expect, it } from 'vitest';
import { scanFileList } from '@/lib/atlas/simulators/fileListScan';

describe('atlas/simulators/fileListScan', () => {
  it('normalizes relative paths, ignores directories, and returns metadata', async () => {
    const guardedFile = { name: 'AGENTS.md', webkitRelativePath: 'repo/AGENTS.md' };
    Object.defineProperty(guardedFile, 'text', {
      value: () => {
        throw new Error('should not read');
      },
    });

    const result = await scanFileList(
      [
        guardedFile,
        { name: 'ignored.txt', webkitRelativePath: 'repo/node_modules/ignored.txt' },
        { name: 'AGENTS.md', webkitRelativePath: 'repo/apps/web/AGENTS.md' },
      ],
      { ignoreDirs: ['node_modules'] },
    );

    expect(result.truncated).toBe(false);
    expect(result.totalFiles).toBe(2);
    expect(result.matchedFiles).toBe(2);
    expect(result.tree.files.map(file => file.path)).toEqual(['AGENTS.md', 'apps/web/AGENTS.md']);
    expect(result.tree.files.every(file => file.content === '')).toBe(true);
  });

  it('applies includeOnly patterns and truncates at maxFiles', async () => {
    const result = await scanFileList(
      [
        { name: 'AGENTS.md', webkitRelativePath: 'repo/AGENTS.md' },
        { name: 'README.md', webkitRelativePath: 'repo/README.md' },
        { name: 'GEMINI.md', webkitRelativePath: 'repo/GEMINI.md' },
      ],
      { includeOnly: [/AGENTS\.md$/], maxFiles: 2, ignoreDirs: [] },
    );

    expect(result.truncated).toBe(true);
    expect(result.totalFiles).toBe(2);
    expect(result.matchedFiles).toBe(1);
    expect(result.tree.files.map(file => file.path)).toEqual(['AGENTS.md']);
    expect(result.tree.files.every(file => file.content === '')).toBe(true);
  });

  it('marks binary instruction files as skipped when content is enabled', async () => {
    const binaryBuffer = new Uint8Array([0, 1, 2, 3]).buffer;
    const result = await scanFileList(
      [
        {
          name: 'AGENTS.md',
          webkitRelativePath: 'repo/AGENTS.md',
          text: async () => 'binary',
          arrayBuffer: async () => binaryBuffer,
        },
      ],
      { includeContent: true, ignoreDirs: [] },
    );

    expect(result.tree.files[0]?.contentStatus).toBe('skipped');
    expect(result.tree.files[0]?.contentReason).toBe('binary');
  });

  it('redacts sensitive file names in displayPath', async () => {
    const result = await scanFileList(
      [{ name: '.env.local', webkitRelativePath: 'repo/.env.local' }],
      { ignoreDirs: [] },
    );

    expect(result.tree.files[0]?.displayPath).toBe('[redacted].env');
  });

  it('normalizes windows-style paths and strips the root folder', async () => {
    const result = await scanFileList(
      [
        { name: 'AGENTS.md', webkitRelativePath: 'repo/apps\\web\\AGENTS.md' },
        { name: 'CLAUDE.md', webkitRelativePath: 'repo/docs\\CLAUDE.md' },
      ],
      { ignoreDirs: [] },
    );

    expect(result.tree.files.map(file => file.path)).toEqual(['apps/web/AGENTS.md', 'docs/CLAUDE.md']);
  });

  it('reports progress at the configured interval', async () => {
    const progress: Array<{ totalFiles: number; matchedFiles: number }> = [];
    const result = await scanFileList(
      [
        { name: 'AGENTS.md', webkitRelativePath: 'repo/AGENTS.md' },
        { name: 'CLAUDE.md', webkitRelativePath: 'repo/CLAUDE.md' },
      ],
      {
        ignoreDirs: [],
        progressInterval: 1,
        onProgress: (snapshot) => progress.push({ ...snapshot }),
      },
    );

    expect(result.totalFiles).toBe(2);
    expect(progress).toEqual([
      { totalFiles: 1, matchedFiles: 0 },
      { totalFiles: 2, matchedFiles: 1 },
      { totalFiles: 2, matchedFiles: 2 },
    ]);
  });
});
