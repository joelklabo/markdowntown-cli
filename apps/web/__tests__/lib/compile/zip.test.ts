import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createZip } from '@/lib/compile/zip';
import type { CompiledFile } from '@/lib/adapters/types';

describe('Zip bundling (v1 compile)', () => {
  it('creates a zip with normalized safe paths', async () => {
    const files: CompiledFile[] = [
      { path: 'AGENTS.md', content: 'Hello' },
      { path: 'dir\\\\file.txt', content: 'World' },
    ];

    const blob = await createZip(files);
    expect(blob.size).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(blob);
    expect(zip.file('AGENTS.md')).not.toBeNull();
    expect(zip.file('dir/file.txt')).not.toBeNull();
    expect(await zip.file('AGENTS.md')?.async('string')).toBe('Hello');
    expect(await zip.file('dir/file.txt')?.async('string')).toBe('World');
  });

  it('rejects unsafe entry paths', async () => {
    await expect(createZip([{ path: '../evil.txt', content: 'x' }], { maxTotalBytes: 1000 })).rejects.toThrow(
      /Unsafe zip entry path/
    );
    await expect(createZip([{ path: '/absolute.txt', content: 'x' }], { maxTotalBytes: 1000 })).rejects.toThrow(
      /absolute paths/
    );
    await expect(createZip([{ path: 'C:\\\\evil.txt', content: 'x' }], { maxTotalBytes: 1000 })).rejects.toThrow(
      /drive-letter/
    );
  });

  it('enforces size guardrails', async () => {
    const files: CompiledFile[] = [
      { path: 'a.txt', content: 'a' },
      { path: 'b.txt', content: 'b' },
    ];

    await expect(createZip(files, { maxFiles: 1, maxTotalBytes: 1000 })).rejects.toThrow(/Too many files/);
    await expect(createZip([{ path: 'big.txt', content: 'abcd' }], { maxTotalBytes: 3 })).rejects.toThrow(
      /too large/i
    );
  });

  it('rejects duplicate paths (after normalization)', async () => {
    const files: CompiledFile[] = [
      { path: 'dir/file.txt', content: '1' },
      { path: 'dir\\\\file.txt', content: '2' },
    ];

    await expect(createZip(files)).rejects.toThrow(/Duplicate file path/);
  });
});

