import { describe, expect, it } from 'vitest';
import { scanForSecrets, scanUamForSecrets } from '@/lib/secretScan';
import { createEmptyUamV1 } from '@/lib/uam/uamTypes';

describe('secret scan', () => {
  it('detects common secret patterns and redacts matches', () => {
    const token = 'ghp_0123456789abcdef0123456789abcdef0123';
    const input = `Token: ${token}\nKey: sk-1234567890abcdefghijklmno123456`;
    const result = scanForSecrets(input);

    expect(result.hasSecrets).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
    expect(result.matches[0]?.redacted).toBe('ghp_…0123');
  });

  it('scans UAM metadata and blocks', () => {
    const uam = createEmptyUamV1({ title: 'Secret test' });
    uam.blocks = [
      {
        id: 'block-1',
        scopeId: 'global',
        kind: 'markdown',
        body: 'Please use AKIA1234567890ABCDE1 for access.',
      },
    ];
    const result = scanUamForSecrets(uam);
    expect(result.hasSecrets).toBe(true);
  });
});
