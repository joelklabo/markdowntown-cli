import { describe, it, expect } from 'vitest';
import { compile } from '@/lib/uam/compile';
import { UniversalAgentDefinition } from '@/lib/uam/types';

describe('UAM Compilation', () => {
  const def: UniversalAgentDefinition = {
    kind: 'UniversalAgent',
    apiVersion: 'v1',
    metadata: { name: 'Test', version: '1' },
    blocks: [
      { id: 'b1', type: 'instruction', content: 'Do generic stuff.' },
    ],
  };

  it('compiles for single target', async () => {
    const result = await compile(def, ['agents-md']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('AGENTS.md');
    expect(result.warnings).toHaveLength(0);
  });

  it('compiles for multiple targets', async () => {
    const result = await compile(def, ['agents-md', 'github-copilot']);
    expect(result.files).toHaveLength(2);
    // order depends on iteration, usually matches input order but aggregated
    const paths = result.files.map(f => f.path).sort();
    expect(paths).toEqual(['.github/copilot-instructions.md', 'AGENTS.md']);
  });

  it('warns on missing adapter', async () => {
    const result = await compile(def, ['missing-adapter']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('not found');
  });

  it('handles mixed valid and invalid targets', async () => {
    const result = await compile(def, ['agents-md', 'missing-adapter']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('AGENTS.md');
    expect(result.warnings).toHaveLength(1);
  });
});
