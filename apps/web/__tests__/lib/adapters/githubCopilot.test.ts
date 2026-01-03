import { describe, expect, it } from 'vitest';
import { githubCopilotAdapter } from '@/lib/adapters/githubCopilot';
import { makeUam } from './fixtures/makeUam';
import { githubCopilotFixtures } from './fixtures/githubCopilot';

describe('GitHub Copilot v1 adapter', () => {
  for (const fixture of githubCopilotFixtures) {
    it(`fixture: ${fixture.name}`, async () => {
      const result = await githubCopilotAdapter.compile(fixture.uam, fixture.target);
      expect(result).toEqual(fixture.expected);
    });
  }

  it('emits global scope to .github/copilot-instructions.md', async () => {
    const uam = makeUam({
      scopes: [{ id: 'global', kind: 'global' }],
      blocks: [
        { id: 'b1', scopeId: 'global', kind: 'markdown', body: 'One' },
        { id: 'b2', scopeId: 'global', kind: 'markdown', body: 'Two' },
      ],
    });

    const result = await githubCopilotAdapter.compile(uam);

    expect(result.warnings).toHaveLength(0);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe('.github/copilot-instructions.md');
    expect(result.files[0]?.content).toContain('One');
    expect(result.files[0]?.content).toContain('Two');
  });

  it('emits glob scopes to .github/instructions/*.instructions.md with applyTo', async () => {
    const uam = makeUam({
      scopes: [{ id: 's1', kind: 'glob', name: 'typescript', patterns: ['src/**/*.ts'] }],
      blocks: [{ id: 'b1', scopeId: 's1', kind: 'markdown', body: 'TS rules' }],
    });

    const result = await githubCopilotAdapter.compile(uam);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe('.github/instructions/typescript.instructions.md');
    expect(result.files[0]?.content).toContain('applyTo: "src/**/*.ts"');
    expect(result.files[0]?.content).toContain('TS rules');
  });

  it('formats multiple applyTo globs as a YAML list', async () => {
    const uam = makeUam({
      scopes: [
        { id: 's1', kind: 'glob', name: 'frontend', patterns: ['src/**/*.tsx', 'src/**/*.ts'] },
      ],
      blocks: [{ id: 'b1', scopeId: 's1', kind: 'markdown', body: 'Frontend rules' }],
    });

    const result = await githubCopilotAdapter.compile(uam);

    expect(result.files).toHaveLength(1);
    const content = result.files[0]?.content ?? '';
    expect(content).toContain('applyTo:');
    expect(content).toContain('  - "src/**/*.ts"');
    expect(content).toContain('  - "src/**/*.tsx"');
  });

  it('warns on non-glob scoped blocks and does not silently mis-scope', async () => {
    const uam = makeUam({
      scopes: [{ id: 's1', kind: 'dir', dir: 'src' }],
      blocks: [{ id: 'b1', scopeId: 's1', kind: 'markdown', body: 'Do not mis-scope me' }],
    });

    const result = await githubCopilotAdapter.compile(uam);

    expect(result.files).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('directory scope');
  });

  it('handles scope name collisions deterministically', async () => {
    const uam = makeUam({
      scopes: [
        { id: 'a', kind: 'glob', name: 'rules', patterns: ['src/**/*.ts'] },
        { id: 'b', kind: 'glob', name: 'rules', patterns: ['src/**/*.tsx'] },
      ],
      blocks: [
        { id: 'b1', scopeId: 'a', kind: 'markdown', body: 'A rules' },
        { id: 'b2', scopeId: 'b', kind: 'markdown', body: 'B rules' },
      ],
    });

    const result = await githubCopilotAdapter.compile(uam);

    expect(result.files.map(f => f.path)).toEqual([
      '.github/instructions/rules-2.instructions.md',
      '.github/instructions/rules.instructions.md',
    ]);
  });

  it('inlines skills into the global instruction file when configured', async () => {
    const uam = makeUam({
      scopes: [{ id: 'global', kind: 'global' }],
      blocks: [{ id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Global rules' }],
      capabilities: [{ id: 'review', title: 'Review', description: 'Check changes' }],
    });

    const result = await githubCopilotAdapter.compile(uam, {
      targetId: 'github-copilot',
      adapterVersion: '1',
      options: { exportSkills: true },
    });

    const global = result.files.find((file) => file.path === '.github/copilot-instructions.md')?.content ?? '';
    expect(global).toContain('Global rules');
    expect(global).toContain('## Skills');
    expect(global).toContain('Review');
  });
});
