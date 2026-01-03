import { describe, it, expect } from 'vitest';
import { windsurfRulesAdapter } from '@/lib/uam/adapters/windsurfRules';
import { UniversalAgentDefinition } from '@/lib/uam/types';

describe('Windsurf Rules Adapter', () => {
  it('compiles to .windsurfrules', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: 'Global info' },
        { id: 'b2', type: 'instruction', content: 'Scoped info', scopes: ['src'] },
      ],
    };

    const result = await windsurfRulesAdapter.compile(def);
    
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('.windsurfrules');
    expect(result.files[0].content).toContain('Global info');
    expect(result.files[0].content).toContain('Rules for "src"');
  });
});
