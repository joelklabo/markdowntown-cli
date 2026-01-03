import { Adapter, CompiledFile } from '../adapters';
import { UniversalAgentDefinition } from '../types';

function isRootScope(scope: string): boolean {
  return scope === 'root' || scope === '.' || scope === '/' || scope === '';
}

function isGlob(scope: string): boolean {
  return scope.includes('*') || scope.includes('?') || scope.includes('[');
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.length > 0 ? slug : 'scope';
}

export const githubCopilotAdapter: Adapter = {
  id: 'github-copilot',
  name: 'GitHub Copilot',
  description:
    'Compiles to .github/copilot-instructions.md and .github/instructions/*.instructions.md.',
  compile: (def: UniversalAgentDefinition) => {
    const warnings: string[] = [];
    const globalParts: string[] = [];
    const scopedPartsByApplyTo = new Map<string, string[]>();

    for (const block of def.blocks) {
      const targetScopes = block.scopes && block.scopes.length > 0 ? block.scopes : ['root'];

      for (const scope of targetScopes) {
        if (isRootScope(scope)) {
          globalParts.push(block.content);
          continue;
        }

        if (!isGlob(scope)) {
          warnings.push(
            `Block '${block.id}' has scope '${scope}' which is not a glob pattern. GitHub Copilot adapter requires glob patterns for scoped blocks.`,
          );
        }

        const parts = scopedPartsByApplyTo.get(scope) ?? [];
        parts.push(block.content);
        scopedPartsByApplyTo.set(scope, parts);
      }
    }

    const files: CompiledFile[] = [];

    if (globalParts.length > 0) {
      files.push({
        path: '.github/copilot-instructions.md',
        content: globalParts.join('\n\n---\n\n'),
      });
    }

    const slugCounts = new Map<string, number>();

    const applyToPatterns = Array.from(scopedPartsByApplyTo.keys()).sort((a, b) => a.localeCompare(b));
    for (const applyTo of applyToPatterns) {
      const parts = scopedPartsByApplyTo.get(applyTo) ?? [];
      if (parts.length === 0) continue;

      const baseName = slugify(applyTo);
      const count = (slugCounts.get(baseName) ?? 0) + 1;
      slugCounts.set(baseName, count);
      const fileName = count === 1 ? baseName : `${baseName}-${count}`;

      files.push({
        path: `.github/instructions/${fileName}.instructions.md`,
        content: `---\napplyTo: "${applyTo}"\n---\n\n${parts.join('\n\n---\n\n')}\n`,
      });
    }

    return { files, warnings };
  }
};
