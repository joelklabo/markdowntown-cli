import { describe, it, expect } from 'vitest';
import { githubCopilotAdapter } from '@/lib/uam/adapters/githubCopilot';
import { UniversalAgentDefinition } from '@/lib/uam/types';

describe('GitHub Copilot Adapter', () => {
  it('compiles global blocks to copilot-instructions.md', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: 'Global instruction.' },
      ],
    };

    const result = await githubCopilotAdapter.compile(def);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('.github/copilot-instructions.md');
    expect(result.files[0].content).toContain('Global instruction.');
    expect(result.warnings).toHaveLength(0);
  });

  it('writes scoped blocks to .github/instructions/*.instructions.md', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: 'TS rules', scopes: ['**/*.ts'] },
      ],
    };

    const result = await githubCopilotAdapter.compile(def);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toMatch(/^\.github\/instructions\/.+\.instructions\.md$/);
    expect(result.files[0].content).toContain('applyTo: "**/*.ts"');
    expect(result.files[0].content).toContain('TS rules');
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on non-glob scopes', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: 'Src rules', scopes: ['src/'] },
      ],
    };

    const result = await githubCopilotAdapter.compile(def);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('not a glob pattern');
    // It should still include the content
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toMatch(/^\.github\/instructions\/.+\.instructions\.md$/);
    expect(result.files[0].content).toContain('applyTo: "src/"');
    expect(result.files[0].content).toContain('Src rules');
  });
});
