import { Adapter, CompiledFile } from '../adapters';
import { UniversalAgentDefinition } from '../types';

export const agentsMdAdapter: Adapter = {
  id: 'agents-md',
  name: 'AGENTS.md',
  description: 'Compiles to AGENTS.md files for root and sub-directories.',
  compile: (def: UniversalAgentDefinition) => {
    const filesMap = new Map<string, string[]>();
    const warnings: string[] = [];

    for (const block of def.blocks) {
      const targetScopes = block.scopes && block.scopes.length > 0 ? block.scopes : ['root'];

      for (const scope of targetScopes) {
        let filePath = '';

        if (scope === 'root' || scope === '.' || scope === '/' || scope === '') {
          filePath = 'AGENTS.md';
        } else {
          // Check for wildcards
          if (scope.includes('*')) {
            warnings.push(`Block '${block.id}' targets glob scope '${scope}' which is not supported by AGENTS.md adapter. Skipped.`);
            continue;
          }
          // Assume directory path
          // Normalize path: remove trailing slash if present
          const cleanScope = scope.endsWith('/') ? scope.slice(0, -1) : scope;
          filePath = `${cleanScope}/AGENTS.md`;
        }

        if (!filesMap.has(filePath)) {
          filesMap.set(filePath, []);
        }
        filesMap.get(filePath)?.push(block.content);
      }
    }

    const files: CompiledFile[] = Array.from(filesMap.entries()).map(([path, contents]) => ({
      path,
      content: contents.join('\n\n'),
    }));

    return { files, warnings };
  }
};