import { describe, it, expect } from 'vitest';
import { UniversalAgentDefinitionSchema } from '@/lib/uam/schema';
import { UniversalAgentDefinition } from '@/lib/uam/types';

describe('UniversalAgentDefinitionSchema', () => {
  it('validates a minimal valid agent definition', () => {
    const validAgent: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: {
        name: 'Test Agent',
        version: '1.0.0',
      },
      blocks: [
        {
          id: 'block-1',
          type: 'instruction',
          content: 'Do something.',
        },
      ],
    };

    const result = UniversalAgentDefinitionSchema.safeParse(validAgent);
    expect(result.success).toBe(true);
  });

  it('validates a full valid agent definition', () => {
    const validAgent: UniversalAgentDefinition = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: {
        name: 'Full Agent',
        version: '1.0.0',
        description: 'A complete agent',
        author: 'Me',
        icon: 'icon.png',
        homepage: 'https://example.com',
        license: 'MIT',
      },
      scopes: ['read_files', 'write_files'],
      capabilities: [
        {
          name: 'web_search',
          description: 'Search the web',
          params: { engine: 'google' },
        },
      ],
      blocks: [
        {
          id: 'b1',
          type: 'instruction',
          content: 'Instruction 1',
        },
        {
          id: 'b2',
          type: 'code',
          content: 'console.log("hello")',
          metadata: { language: 'javascript' },
        },
      ],
      targets: [
        {
          platform: 'vscode',
          minVersion: '1.80.0',
        },
      ],
    };

    const result = UniversalAgentDefinitionSchema.safeParse(validAgent);
    expect(result.success).toBe(true);
  });

  it('fails validation for invalid kind', () => {
    const invalidAgent = {
      kind: 'NotUniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1.0' },
      blocks: [],
    };
    const result = UniversalAgentDefinitionSchema.safeParse(invalidAgent);
    expect(result.success).toBe(false);
  });

  it('fails validation for missing blocks', () => {
    const invalidAgent = {
      kind: 'UniversalAgent',
      apiVersion: 'v1',
      metadata: { name: 'Test', version: '1.0' },
      // blocks missing
    };
    const result = UniversalAgentDefinitionSchema.safeParse(invalidAgent);
    expect(result.success).toBe(false);
  });
});
