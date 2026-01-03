import { Adapter, CompiledFile } from '../adapters';
import { UniversalAgentDefinition } from '../types';

export const cursorRulesAdapter: Adapter = {
  id: 'cursor-rules',
  name: 'Cursor Rules',
  description: 'Compiles to .cursorrules file.',
  compile: (def: UniversalAgentDefinition) => {
    const warnings: string[] = [];
    const files: CompiledFile[] = [];
    
    const parts: string[] = [];

    // Helper to check for glob
    const isGlob = (s: string) => s.includes('*') || s.includes('?') || s.includes('[');

    for (const block of def.blocks) {
      const targetScopes = block.scopes && block.scopes.length > 0 ? block.scopes : ['root'];
      
      for (const scope of targetScopes) {
        if (scope === 'root' || scope === '.' || scope === '/' || scope === '') {
          parts.push(block.content);
        } else {
           // Cursor supports globs? .cursorrules is usually one file.
           // People often use a format like "Rules for *.ts:" inside it.
           // Cursor AI reads the context.
           
           // If we wanted to split into multiple .cursorrules in subdirectories, we could.
           // But the task says "Compiles to correct Cursor structure".
           // Usually one root .cursorrules is best practice now.
           
           if (isGlob(scope)) {
             parts.push(`Rules for files matching "${scope}":\n${block.content}`);
           } else {
             // Treat as directory path or specific file
             parts.push(`Rules for "${scope}":\n${block.content}`);
           }
        }
      }
    }

    files.push({
      path: '.cursorrules',
      content: parts.join('\n\n---\n\n'),
    });

    return { files, warnings };
  }
};
