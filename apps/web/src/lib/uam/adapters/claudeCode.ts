import { Adapter, CompiledFile } from '../adapters';
import { UniversalAgentDefinition } from '../types';

export const claudeCodeAdapter: Adapter = {
  id: 'claude-code',
  name: 'Claude Code',
  description: 'Compiles to .claude/config.json and instruction files.',
  compile: (def: UniversalAgentDefinition) => {
    const warnings: string[] = [];
    const files: CompiledFile[] = [];
    
    // Claude Code doesn't have a single instruction file like Copilot.
    // It uses .claude.json or similar config, or just prompts.
    // Assuming standard "Project Instructions" usually go into a system prompt or specific file.
    // For now, let's map global instructions to `.claude/instructions.md` (hypothetical standard)
    // or just a well-known location.
    
    // Actually, widespread convention for "Claude Code" (CLI) isn't fully standardized on "instructions" file path yet,
    // but usually users pass context via files.
    // However, if we assume this is for "Claude Projects" (web), it's just knowledge.
    
    // Let's assume the user wants a `CLAUDE.md` in root, which is a common convention for "Context for Claude".
    
    const parts: string[] = [];

    for (const block of def.blocks) {
      const targetScopes = block.scopes && block.scopes.length > 0 ? block.scopes : ['root'];
      
      for (const scope of targetScopes) {
        if (scope === 'root' || scope === '.' || scope === '/' || scope === '') {
          parts.push(block.content);
        } else {
           parts.push(`### Scope: ${scope}\n\n${block.content}`);
        }
      }
    }

    files.push({
      path: 'CLAUDE.md',
      content: parts.join('\n\n---\n\n'),
    });

    return { files, warnings };
  }
};
