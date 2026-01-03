import { describe, expect, it } from 'vitest';
import { geminiCliAdapter } from '@/lib/adapters/geminiCli';
import type { UamTargetV1, UamV1 } from '@/lib/uam/uamTypes';
import { makeUam } from './fixtures/makeUam';
import { geminiCliFixtures } from './fixtures/geminiCli';

function uamFixture(overrides: Partial<UamV1> = {}): UamV1 {
  return makeUam(overrides);
}

describe('Gemini CLI v1 adapter', () => {
  for (const fixture of geminiCliFixtures) {
    it(`fixture: ${fixture.name}`, async () => {
      const result = await geminiCliAdapter.compile(fixture.uam, fixture.target);
      expect(result).toEqual(fixture.expected);
    });
  }

  it('emits GEMINI.md in flat mode with scope sections (lossy)', async () => {
    const uam = uamFixture({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
        { id: 'ts', kind: 'glob', name: 'typescript', patterns: ['src/**/*.ts'] },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global rules' },
        { id: 'b2', scopeId: 'src', kind: 'markdown', body: 'Src rules' },
        { id: 'b3', scopeId: 'ts', kind: 'markdown', body: 'TS rules' },
      ],
    });

    const result = await geminiCliAdapter.compile(uam);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe('GEMINI.md');
    expect(result.files[0]?.content).toBe(
      [
        'Global rules',
        '',
        '---',
        '',
        '## Scope: src',
        '',
        'Src rules',
        '',
        '---',
        '',
        '## Scope: src/**/*.ts',
        '',
        'TS rules',
        '',
      ].join('\n')
    );
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('lossy');
    expect(result.warnings[1]).toContain('lossy');
  });

  it('emits GEMINI.md and @include scope files in modular mode', async () => {
    const uam = uamFixture({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
        { id: 'ts', kind: 'glob', name: 'typescript', patterns: ['src/**/*.ts'] },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global rules' },
        { id: 'b2', scopeId: 'src', kind: 'markdown', body: 'Src rules' },
        { id: 'b3', scopeId: 'ts', kind: 'markdown', body: 'TS rules' },
      ],
    });

    const target: UamTargetV1 = { targetId: 'gemini-cli', adapterVersion: '1', options: { modular: true } };
    const result = await geminiCliAdapter.compile(uam, target);

    expect(result.files.map(f => f.path)).toEqual(['.gemini/scopes/src.md', '.gemini/scopes/typescript.md', 'GEMINI.md']);

    expect(result.files.find(f => f.path === 'GEMINI.md')?.content).toBe(
      ['Global rules', '', '---', '', '@.gemini/scopes/src.md', '@.gemini/scopes/typescript.md', ''].join('\n')
    );

    expect(result.files.find(f => f.path === '.gemini/scopes/src.md')?.content).toBe(
      ['# Scope: src', '', 'Src rules', ''].join('\n')
    );
    expect(result.files.find(f => f.path === '.gemini/scopes/typescript.md')?.content).toBe(
      ['# Scope: src/**/*.ts', '', 'TS rules', ''].join('\n')
    );
    expect(result.warnings).toHaveLength(2);
  });
});
