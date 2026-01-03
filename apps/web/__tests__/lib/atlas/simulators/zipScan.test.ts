// @vitest-environment node
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { scanZipFile, ZipScanError } from '@/lib/atlas/simulators/zipScan';

async function buildZipFile(entries: Array<{ path: string; content: string }>, name = 'repo.zip') {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.path, entry.content);
  }
  const buffer = await zip.generateAsync({ type: 'uint8array' });
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return new File([arrayBuffer], name, { type: 'application/zip' });
}

describe('scanZipFile', () => {
  it('reads ZIP contents and ignores default ignored dirs', async () => {
    const file = await buildZipFile([
      { path: 'AGENTS.md', content: '# Agents' },
      { path: 'README.md', content: 'Hello' },
      { path: 'node_modules/ignore.txt', content: 'nope' },
    ]);

    const result = await scanZipFile(file, { includeContent: true });
    const paths = result.tree.files.map((entry) => entry.path).sort();
    expect(paths).toEqual(['AGENTS.md', 'README.md']);
    expect(result.totalFiles).toBeGreaterThanOrEqual(2);
  });

  it('rejects ZIPs that exceed compressed size limits', async () => {
    const file = await buildZipFile([{ path: 'AGENTS.md', content: '# Agents' }]);
    await expect(scanZipFile(file, { maxCompressedBytes: 1 })).rejects.toMatchObject({ kind: 'oversize' });
  });

  it('rejects ZIPs that exceed uncompressed size limits', async () => {
    const file = await buildZipFile([{ path: 'AGENTS.md', content: '# Agents' }]);
    await expect(scanZipFile(file, { maxUncompressedBytes: 1 })).rejects.toMatchObject({ kind: 'oversize' });
  });

  it('rejects corrupt ZIP files', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bad.zip', { type: 'application/zip' });
    await expect(scanZipFile(file)).rejects.toBeInstanceOf(ZipScanError);
    await expect(scanZipFile(file)).rejects.toMatchObject({ kind: 'corrupt' });
  });
});
