import { describe, it, expect } from 'vitest';
import { agentsMdAdapter } from '@/lib/uam/adapters/agentsMd';
import { UniversalAgentDefinition } from '@/lib/uam/types';
import { CompiledFile } from '@/lib/uam/adapters';

describe('AGENTS.md Adapter', () => {
  it('compiles global blocks to root AGENTS.md', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'b1', type: 'instruction', content: '# Instructions\nDo this.' },
        { id: 'b2', type: 'instruction', content: 'Also do that.' },
      ],
    };

    const result = await agentsMdAdapter.compile(def);
    
    expect(result.warnings).toHaveLength(0);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('AGENTS.md');
    expect(result.files[0].content).toContain('# Instructions');
    expect(result.files[0].content).toContain('Also do that.');
  });

  it('compiles scoped blocks to directory AGENTS.md', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'root-block', type: 'instruction', content: 'Root content' },
        { id: 'src-block', type: 'instruction', content: 'Src content', scopes: ['src'] },
        { id: 'lib-block', type: 'instruction', content: 'Lib content', scopes: ['src/lib'] },
      ],
    };

    const result = await agentsMdAdapter.compile(def);
    
    expect(result.files).toHaveLength(3);
    const rootFile = result.files.find((f: CompiledFile) => f.path === 'AGENTS.md');
    const srcFile = result.files.find((f: CompiledFile) => f.path === 'src/AGENTS.md');
    const libFile = result.files.find((f: CompiledFile) => f.path === 'src/lib/AGENTS.md');

    expect(rootFile?.content).toBe('Root content');
    expect(srcFile?.content).toBe('Src content');
    expect(libFile?.content).toBe('Lib content');
  });

  it('warns on glob scopes', async () => {
    const def: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1' },
      blocks: [
        { id: 'glob-block', type: 'instruction', content: 'Bad content', scopes: ['src/**/*.ts'] },
      ],
    };

    const result = await agentsMdAdapter.compile(def);
    
    expect(result.files).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('glob scope');
  });
});
