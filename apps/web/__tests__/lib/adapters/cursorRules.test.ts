import { describe, expect, it } from 'vitest';
import { cursorRulesAdapter } from '@/lib/adapters/cursorRules';
import { makeUam } from './fixtures/makeUam';
import { cursorRulesFixtures } from './fixtures/cursorRules';

describe('Cursor rules v1 adapter', () => {
  for (const fixture of cursorRulesFixtures) {
    it(`fixture: ${fixture.name}`, async () => {
      const result = await cursorRulesAdapter.compile(fixture.uam, fixture.target);
      expect(result).toEqual(fixture.expected);
    });
  }

  it('writes global rules as alwaysApply: true', async () => {
    const uam = makeUam({
      scopes: [{ id: 'global', kind: 'global' }],
      blocks: [{ id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global body' }],
    });

    const result = await cursorRulesAdapter.compile(uam);

    expect(result.warnings).toHaveLength(0);
    expect(result.files.map(f => f.path)).toEqual(['.cursor/rules/global.mdc']);
    expect(result.files[0]?.content).toBe(
      [
        '---',
        'description: "Global rules"',
        'globs:',
        '  - "**/*"',
        'alwaysApply: true',
        '---',
        '',
        'Global body',
        '',
      ].join('\n')
    );
  });

  it('writes scoped rules with globs and alwaysApply: false', async () => {
    const uam = makeUam({
      scopes: [
        { id: 'global', kind: 'global' },
        { id: 'src', kind: 'dir', dir: 'src' },
        { id: 'ts', kind: 'glob', name: 'typescript', patterns: ['src/**/*.ts'] },
      ],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global body' },
        { id: 'b2', scopeId: 'src', kind: 'markdown', body: 'Src body' },
        { id: 'b3', scopeId: 'ts', kind: 'markdown', body: 'TS body' },
      ],
    });

    const result = await cursorRulesAdapter.compile(uam);

    expect(result.warnings).toHaveLength(0);
    expect(result.files.map(f => f.path)).toEqual([
      '.cursor/rules/global.mdc',
      '.cursor/rules/src.mdc',
      '.cursor/rules/typescript.mdc',
    ]);

    expect(result.files.find(f => f.path === '.cursor/rules/src.mdc')?.content).toBe(
      [
        '---',
        'description: "Rules for src"',
        'globs:',
        '  - "src/**"',
        'alwaysApply: false',
        '---',
        '',
        'Src body',
        '',
      ].join('\n')
    );

    expect(result.files.find(f => f.path === '.cursor/rules/typescript.mdc')?.content).toBe(
      [
        '---',
        'description: "typescript"',
        'globs:',
        '  - "src/**/*.ts"',
        'alwaysApply: false',
        '---',
        '',
        'TS body',
        '',
      ].join('\n')
    );
  });
});
