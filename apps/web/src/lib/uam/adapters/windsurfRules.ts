import { Adapter, CompiledFile } from '../adapters';
import { UniversalAgentDefinition } from '../types';

export const windsurfRulesAdapter: Adapter = {
  id: 'windsurf-rules',
  name: 'Windsurf Rules',
  description: 'Compiles to .windsurfrules file.',
  compile: (def: UniversalAgentDefinition) => {
    const warnings: string[] = [];
    const files: CompiledFile[] = [];
    
    const parts: string[] = [];

    for (const block of def.blocks) {
      const targetScopes = block.scopes && block.scopes.length > 0 ? block.scopes : ['root'];
      
      for (const scope of targetScopes) {
        if (scope === 'root' || scope === '.' || scope === '/' || scope === '') {
          parts.push(block.content);
        } else {
           // Windsurf format similar to Cursor, natural language.
           parts.push(`Rules for "${scope}":\n${block.content}`);
        }
      }
    }

    files.push({
      path: '.windsurfrules',
      content: parts.join('\n\n---\n\n'),
    });

    return { files, warnings };
  }
};
