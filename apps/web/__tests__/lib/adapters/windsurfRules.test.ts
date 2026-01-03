import { describe, expect, it } from 'vitest';
import { windsurfRulesAdapter } from '@/lib/adapters/windsurfRules';
import { makeUam } from './fixtures/makeUam';
import { windsurfRulesFixtures } from './fixtures/windsurfRules';

describe('Windsurf rules v1 adapter', () => {
  for (const fixture of windsurfRulesFixtures) {
    it(`fixture: ${fixture.name}`, async () => {
      const result = await windsurfRulesAdapter.compile(fixture.uam, fixture.target);
      expect(result).toEqual(fixture.expected);
    });
  }

  it('emits global_rules.md and .windsurf/rules/*.md for scoped blocks', async () => {
    const uam = makeUam({
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

    const result = await windsurfRulesAdapter.compile(uam);

    expect(result.warnings).toHaveLength(0);
    expect(result.files.map(f => f.path)).toEqual([
      '.windsurf/rules/src.md',
      '.windsurf/rules/typescript.md',
      'global_rules.md',
    ]);

    expect(result.files.find(f => f.path === 'global_rules.md')?.content).toBe('Global rules\n');

    expect(result.files.find(f => f.path === '.windsurf/rules/src.md')?.content).toBe(
      ['# Rules for src', '', 'Src rules', ''].join('\n')
    );

    expect(result.files.find(f => f.path === '.windsurf/rules/typescript.md')?.content).toBe(
      ['# Rules for src/**/*.ts', '', 'TS rules', ''].join('\n')
    );
  });
});
