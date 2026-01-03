import type { Adapter, CompiledFile } from './types';
import type { UamScopeV1, UamTargetV1, UamV1 } from '../uam/uamTypes';
import { parseSkillExportConfig, renderSkillsInlineSection, resolveSkillExport } from '../skills/skillExport';

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.length > 0 ? slug : 'scope';
}

function yamlQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function renderApplyToFrontmatter(patterns: string[]): string {
  const unique = Array.from(new Set(patterns)).sort((a, b) => a.localeCompare(b));
  if (unique.length === 1) {
    return `---\napplyTo: ${yamlQuote(unique[0] ?? '')}\n---\n`;
  }

  const items = unique.map(p => `  - ${yamlQuote(p)}`).join('\n');
  return `---\napplyTo:\n${items}\n---\n`;
}

function deriveScopeName(scope: Extract<UamScopeV1, { kind: 'glob' }>): string {
  if (scope.name && scope.name.trim().length > 0) return slugify(scope.name);
  return slugify(scope.patterns.join(' '));
}

export const githubCopilotAdapter: Adapter = {
  id: 'github-copilot',
  version: '1',
  label: 'GitHub Copilot',
  description: 'Exports UAM v1 to GitHub Copilot instruction files.',
  compile: (uam: UamV1, target?: UamTargetV1) => {
    const warnings: string[] = [];
    const info: string[] = [];

    const scopeById = new Map(uam.scopes.map(s => [s.id, s] as const));
    const globalParts: string[] = [];

    const blocksByGlobScopeId = new Map<string, string[]>();
    const globScopes = new Map<string, Extract<UamScopeV1, { kind: 'glob' }>>();

    for (const scope of uam.scopes) {
      if (scope.kind === 'glob') globScopes.set(scope.id, scope);
    }

    for (const block of uam.blocks) {
      const scope = scopeById.get(block.scopeId);
      if (!scope) {
        warnings.push(`Block '${block.id}' references unknown scopeId '${block.scopeId}'. Skipped.`);
        continue;
      }

      if (scope.kind === 'global') {
        globalParts.push(block.body.trimEnd());
        continue;
      }

      if (scope.kind === 'glob') {
        const parts = blocksByGlobScopeId.get(scope.id) ?? [];
        parts.push(block.body.trimEnd());
        blocksByGlobScopeId.set(scope.id, parts);
        continue;
      }

      warnings.push(
        `Block '${block.id}' targets directory scope '${scope.dir}', which cannot be expressed as Copilot applyTo globs. Skipped.`
      );
    }

    const files: CompiledFile[] = [];

    const { exportAll, allowList } = parseSkillExportConfig(target as UamTargetV1 | undefined);
    let skillsSection = '';
    if (exportAll || allowList) {
      const resolved = resolveSkillExport(uam, { exportAll, allowList });
      warnings.push(...resolved.warnings);
      skillsSection = renderSkillsInlineSection(resolved.capabilities, 'Skills');
    }

    const globalPartsWithSkills = skillsSection.length > 0 ? [...globalParts, skillsSection] : globalParts;

    if (globalPartsWithSkills.length > 0) {
      files.push({
        path: '.github/copilot-instructions.md',
        content: globalPartsWithSkills.join('\n\n'),
      });
    }

    const globScopeIdsWithBlocks = Array.from(blocksByGlobScopeId.keys());
    const scoped = globScopeIdsWithBlocks
      .map(scopeId => ({ scopeId, scope: globScopes.get(scopeId) }))
      .filter((x): x is { scopeId: string; scope: Extract<UamScopeV1, { kind: 'glob' }> } => Boolean(x.scope))
      .map(x => ({ ...x, baseName: deriveScopeName(x.scope) }))
      .sort((a, b) => a.baseName.localeCompare(b.baseName) || a.scopeId.localeCompare(b.scopeId));

    const nameCounts = new Map<string, number>();
    for (const entry of scoped) {
      const count = (nameCounts.get(entry.baseName) ?? 0) + 1;
      nameCounts.set(entry.baseName, count);
      const fileName = count === 1 ? entry.baseName : `${entry.baseName}-${count}`;

      const parts = blocksByGlobScopeId.get(entry.scopeId) ?? [];
      files.push({
        path: `.github/instructions/${fileName}.instructions.md`,
        content: `${renderApplyToFrontmatter(entry.scope.patterns)}${parts.join('\n\n')}\n`,
      });
    }

    files.sort((a, b) => a.path.localeCompare(b.path));
    return { files, warnings, info };
  },
};
