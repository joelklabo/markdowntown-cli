import { describe, it, expect } from 'vitest';
import { cursorRulesAdapter } from '@/lib/uam/adapters/cursorRules';
import { UniversalAgentDefinition } from '@/lib/uam/types';

describe('Cursor Rules Adapter', () => {
  it('compiles to .cursorrules', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: 'Global rule' },
        { id: 'b2', type: 'instruction', content: 'TS rule', scopes: ['**/*.ts'] },
      ],
    };

    const result = await cursorRulesAdapter.compile(def);
    
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('.cursorrules');
    expect(result.files[0].content).toContain('Global rule');
    expect(result.files[0].content).toContain('Rules for files matching "**/*.ts"');
  });
});
