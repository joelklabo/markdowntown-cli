import { describe, it, expect } from 'vitest';
import { geminiCliAdapter } from '@/lib/uam/adapters/geminiCli';
import { UniversalAgentDefinition } from '@/lib/uam/types';

describe('Gemini CLI Adapter', () => {
  it('compiles to GEMINI.md', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: 'Gemini info' },
      ],
    };

    const result = await geminiCliAdapter.compile(def);
    
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('GEMINI.md');
    expect(result.files[0].content).toContain('Gemini info');
  });
});
