import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createAtlasExamplesZip } from '@/lib/atlas/examplesZip';

const routePromise = import('@/app/api/atlas/examples/zip/route');

describe('POST /api/atlas/examples/zip', () => {
  it('returns a zip containing selected Atlas example files', async () => {
    const { POST } = await routePromise;
    const res = await POST(
      new Request('http://localhost/api/atlas/examples/zip', {
        method: 'POST',
        body: JSON.stringify({
          files: [
            { platformId: 'claude-code', fileName: 'CLAUDE.md' },
            { platformId: 'github-copilot', fileName: 'copilot-instructions.md' },
          ],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');

    const buffer = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    const files = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name)
      .sort();

    expect(files).toEqual([
      'claude-code/CLAUDE.md',
      'github-copilot/copilot-instructions.md',
    ]);

    const claudeExample = await zip.file('claude-code/CLAUDE.md')!.async('string');
    expect(claudeExample).toContain('CLAUDE.md');
  });

  it('enforces max file and total byte limits', async () => {
    await expect(
      createAtlasExamplesZip(
        [
          { platformId: 'claude-code', fileName: 'CLAUDE.md' },
          { platformId: 'github-copilot', fileName: 'copilot-instructions.md' },
        ],
        { maxFiles: 1 },
      ),
    ).rejects.toThrow(/Too many files selected/);
  });
});
