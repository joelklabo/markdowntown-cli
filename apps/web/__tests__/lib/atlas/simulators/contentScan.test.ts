import { describe, expect, it } from 'vitest';
import { readInstructionContent, redactSensitivePath } from '@/lib/atlas/simulators/contentScan';

describe('atlas/simulators/contentScan', () => {
  it('skips binary instruction content', async () => {
    const result = await readInstructionContent(
      'AGENTS.md',
      async () => ({
        size: 4,
        text: async () => 'binary',
        arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer,
      }),
      { maxBytes: 64 },
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('binary');
    expect(result.content).toBeNull();
  });

  it('truncates content by byte limit', async () => {
    const payload = '🙂'.repeat(10);
    const result = await readInstructionContent(
      'AGENTS.md',
      async () => ({
        text: async () => payload,
      }),
      { maxBytes: 12 },
    );

    expect(result.skipped).toBe(false);
    expect(result.truncated).toBe(true);
    expect(result.content).not.toBeNull();
    const encodedLength = new TextEncoder().encode(result.content ?? '').length;
    expect(encodedLength).toBeLessThanOrEqual(12);
  });

  it('redacts sensitive file names', () => {
    expect(redactSensitivePath('.env.local')).toBe('[redacted].env');
    expect(redactSensitivePath('src/.env')).toBe('src/[redacted].env');
    expect(redactSensitivePath('README.md')).toBe('README.md');
  });
});
