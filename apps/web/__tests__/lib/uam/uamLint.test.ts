import { describe, expect, it } from 'vitest';
import { lintUamV1 } from '@/lib/uam/uamLint';
import type { UamV1 } from '@/lib/uam/uamTypes';

function uamFixture(overrides: Partial<UamV1> = {}): UamV1 {
  return {
    schemaVersion: 1,
    meta: { title: 'Test' },
    scopes: [{ id: 'global', kind: 'global' }],
    blocks: [],
    capabilities: [],
    targets: [],
    ...overrides,
  };
}

describe('lintUamV1', () => {
  it('warns when setup + test commands are missing', () => {
    const uam = uamFixture({
      blocks: [{ id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Hello' }],
    });

    const warnings = lintUamV1(uam);

    expect(warnings.some(w => w.code === 'missing-setup-command')).toBe(true);
    expect(warnings.some(w => w.code === 'missing-test-command')).toBe(true);
  });

  it('flags dangerous command patterns in commands blocks', () => {
    const uam = uamFixture({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
      ],
      blocks: [
        { id: 'b0', scopeId: 'global', kind: 'commands', body: '```bash\npnpm install\npnpm test\n```' },
        { id: 'b1', scopeId: 'src', kind: 'commands', body: '```bash\nrm -rf .\n```' },
      ],
    });

    const warnings = lintUamV1(uam);
    const danger = warnings.find(w => w.code === 'dangerous-command');

    expect(danger?.scopeId).toBe('src');
    expect(danger?.message).toContain('rm -rf');
  });

  it('warns when a target cannot represent a scope kind', () => {
    const uam = uamFixture({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
      ],
      targets: [{ targetId: 'github-copilot', adapterVersion: '1', options: {} }],
      blocks: [
        { id: 'b0', scopeId: 'global', kind: 'commands', body: '```bash\npnpm install\npnpm test\n```' },
        { id: 'b1', scopeId: 'src', kind: 'markdown', body: 'Dir rules' },
      ],
    });

    const warnings = lintUamV1(uam);
    const unsupported = warnings.find(w => w.code === 'unsupported-scope');

    expect(unsupported?.scopeId).toBe('src');
    expect(unsupported?.message).toContain("github-copilot");
  });

  it('warns when a target is known to be lossy for scoped rules', () => {
    const uam = uamFixture({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
      ],
      targets: [{ targetId: 'gemini-cli', adapterVersion: '1', options: {} }],
      blocks: [
        { id: 'b0', scopeId: 'global', kind: 'commands', body: '```bash\npnpm install\npnpm test\n```' },
        { id: 'b1', scopeId: 'src', kind: 'markdown', body: 'Dir rules' },
      ],
    });

    const warnings = lintUamV1(uam);
    const lossy = warnings.find(w => w.code === 'lossy-scope');

    expect(lossy?.scopeId).toBe('src');
    expect(lossy?.message).toContain("gemini-cli");
  });
});

