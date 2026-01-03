import type { Adapter, CompiledFile } from './types';
import type { UamScopeV1, UamTargetV1, UamV1 } from '../uam/uamTypes';
import { parseSkillExportConfig, renderSkillsInlineSection, resolveSkillExport } from '../skills/skillExport';

function normalizeDirScope(dir: string): string {
  const normalized = dir.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (normalized === '' || normalized === '.' || normalized === '/') return '';
  return normalized;
}

function scopeToAgentsMdPath(scope: UamScopeV1): { path: string | null; reason?: string } {
  if (scope.kind === 'global') return { path: 'AGENTS.md' };

  if (scope.kind === 'dir') {
    const dir = normalizeDirScope(scope.dir);
    return { path: dir === '' ? 'AGENTS.md' : `${dir}/AGENTS.md` };
  }

  return { path: null, reason: `glob scope (${scope.patterns.join(', ')})` };
}

export const agentsMdCodexAdapter: Adapter = {
  id: 'agents-md',
  version: '1',
  label: 'AGENTS.md',
  description: 'Exports UAM v1 scopes into AGENTS.md files.',
  compile: (uam: UamV1, target?: UamTargetV1) => {
    const warnings: string[] = [];
    const info: string[] = [];

    const scopeById = new Map(uam.scopes.map(s => [s.id, s] as const));
    const contentsByPath = new Map<string, string[]>();
    const warnedDuplicatePath = new Set<string>();
    const scopeIdsByPath = new Map<string, Set<string>>();

    for (const block of uam.blocks) {
      const scope = scopeById.get(block.scopeId);
      if (!scope) {
        warnings.push(`Block '${block.id}' references unknown scopeId '${block.scopeId}'. Skipped.`);
        continue;
      }

      const { path, reason } = scopeToAgentsMdPath(scope);
      if (!path) {
        warnings.push(`Block '${block.id}' targets ${reason}, which is not supported by AGENTS.md exporter. Skipped.`);
        continue;
      }

      const scopeIds = scopeIdsByPath.get(path) ?? new Set<string>();
      if (scopeIds.size > 0 && !scopeIds.has(scope.id) && !warnedDuplicatePath.has(path)) {
        warnedDuplicatePath.add(path);
        warnings.push(`Multiple scopes map to '${path}'. Merging their blocks.`);
      }
      scopeIds.add(scope.id);
      scopeIdsByPath.set(path, scopeIds);

      const contentParts = contentsByPath.get(path) ?? [];
      contentParts.push(block.body.trimEnd());
      contentsByPath.set(path, contentParts);
    }

    const { exportAll, allowList } = parseSkillExportConfig(target as UamTargetV1 | undefined);
    if (exportAll || allowList) {
      const resolved = resolveSkillExport(uam, { exportAll, allowList });
      warnings.push(...resolved.warnings);
      const skillsSection = renderSkillsInlineSection(resolved.capabilities, 'Skills');
      if (skillsSection.length > 0) {
        const path = 'AGENTS.md';
        const contentParts = contentsByPath.get(path) ?? [];
        contentParts.push(skillsSection);
        contentsByPath.set(path, contentParts);
      }
    }

    const files: CompiledFile[] = Array.from(contentsByPath.entries())
      .map(([path, parts]) => ({
        path,
        content: parts.join('\n\n'),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return { files, warnings, info };
  },
};
