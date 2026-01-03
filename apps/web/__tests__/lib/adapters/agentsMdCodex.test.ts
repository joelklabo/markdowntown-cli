import { describe, expect, it } from 'vitest';
import { agentsMdCodexAdapter } from '@/lib/adapters/agentsMdCodex';
import { makeUam } from './fixtures/makeUam';
import { agentsMdCodexFixtures } from './fixtures/agentsMdCodex';

describe('AGENTS.md (Codex) v1 adapter', () => {
  for (const fixture of agentsMdCodexFixtures) {
    it(`fixture: ${fixture.name}`, async () => {
      const result = await agentsMdCodexAdapter.compile(fixture.uam, fixture.target);
      expect(result).toEqual(fixture.expected);
    });
  }

  it('warns on glob scopes and skips them', async () => {
    const uam = makeUam({
      scopes: [{ id: 'g1', kind: 'glob', patterns: ['src/**/*.ts'] }],
      blocks: [{ id: 'b1', scopeId: 'g1', kind: 'markdown', body: 'Bad content' }],
    });

    const result = await agentsMdCodexAdapter.compile(uam);

    expect(result.files).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('glob scope');
  });

  it('handles duplicate directory paths deterministically', async () => {
    const uam = makeUam({
      scopes: [
        { id: 's1', kind: 'dir', dir: 'src' },
        { id: 's2', kind: 'dir', dir: 'src/' },
      ],
      blocks: [
        { id: 'b1', scopeId: 's1', kind: 'markdown', body: 'One' },
        { id: 'b2', scopeId: 's2', kind: 'markdown', body: 'Two' },
      ],
    });

    const result = await agentsMdCodexAdapter.compile(uam);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe('src/AGENTS.md');
    expect(result.files[0]?.content).toBe('One\n\nTwo');
    expect(result.warnings.some(w => w.includes('Multiple scopes map'))).toBe(true);
  });

  it('inlines skills into AGENTS.md when configured', async () => {
    const uam = makeUam({
      scopes: [{ id: 'global', kind: 'global' }],
      blocks: [{ id: 'b1', scopeId: 'global', kind: 'markdown', body: 'Root content' }],
      capabilities: [{ id: 'review', title: 'Review', description: 'Check changes' }],
    });

    const result = await agentsMdCodexAdapter.compile(uam, {
      targetId: 'agents-md',
      adapterVersion: '1',
      options: { exportSkills: true },
    });

    const root = result.files.find((file) => file.path === 'AGENTS.md')?.content ?? '';
    expect(root).toContain('Root content');
    expect(root).toContain('## Skills');
    expect(root).toContain('Review');
  });
});
