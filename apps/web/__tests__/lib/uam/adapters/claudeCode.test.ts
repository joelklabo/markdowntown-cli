import { describe, it, expect } from 'vitest';
import { claudeCodeAdapter } from '@/lib/uam/adapters/claudeCode';
import { UniversalAgentDefinition } from '@/lib/uam/types';

describe('Claude Code Adapter', () => {
  it('compiles to CLAUDE.md', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: 'Global info' },
        { id: 'b2', type: 'instruction', content: 'Scoped info', scopes: ['src'] },
      ],
    };

    const result = await claudeCodeAdapter.compile(def);
    
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('CLAUDE.md');
    expect(result.files[0].content).toContain('Global info');
    expect(result.files[0].content).toContain('Scope: src');
  });
});
