import type { Adapter, CompiledFile } from './types';
import type { UamScopeV1, UamV1 } from '../uam/uamTypes';

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.length > 0 ? slug : 'rules';
}

function normalizeDir(dir: string): string {
  const normalized = dir.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (normalized === '' || normalized === '.' || normalized === '/') return '';
  return normalized;
}

function scopeBaseName(scope: Extract<UamScopeV1, { kind: 'dir' | 'glob' }>): string {
  const named = scope.name?.trim();
  if (named && named.length > 0) return slugify(named);

  if (scope.kind === 'dir') {
    const dir = normalizeDir(scope.dir);
    return slugify(dir.length > 0 ? dir : 'root');
  }

  return slugify(scope.patterns.join(' '));
}

function scopeHeader(scope: Extract<UamScopeV1, { kind: 'dir' | 'glob' }>): string {
  if (scope.kind === 'dir') {
    const dir = normalizeDir(scope.dir);
    return `# Rules for ${dir.length > 0 ? dir : 'root'}`;
  }
  const patterns = scope.patterns.join(', ').trim();
  return `# Rules for ${patterns.length > 0 ? patterns : 'glob'}`;
}

function joinParts(parts: string[]): string {
  return parts.map(p => p.trimEnd()).filter(Boolean).join('\n\n---\n\n').trimEnd();
}

export const windsurfRulesAdapter: Adapter = {
  id: 'windsurf-rules',
  version: '1',
  label: 'Windsurf Rules',
  description: 'Exports UAM v1 to global_rules.md and .windsurf/rules/*.md.',
  compile: (uam: UamV1) => {
    const warnings: string[] = [];
    const info: string[] = [];
    const files: CompiledFile[] = [];

    const scopeById = new Map(uam.scopes.map(s => [s.id, s] as const));
    const globalParts: string[] = [];
    const scopedPartsByScopeId = new Map<string, string[]>();

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

      const parts = scopedPartsByScopeId.get(scope.id) ?? [];
      parts.push(block.body.trimEnd());
      scopedPartsByScopeId.set(scope.id, parts);
    }

    if (globalParts.length > 0) {
      files.push({ path: 'global_rules.md', content: joinParts(globalParts) + '\n' });
    }

    const scoped = Array.from(scopedPartsByScopeId.entries())
      .map(([scopeId, parts]) => ({ scopeId, parts, scope: scopeById.get(scopeId) }))
      .filter((x): x is { scopeId: string; parts: string[]; scope: Extract<UamScopeV1, { kind: 'dir' | 'glob' }> } => {
        if (!x.scope) return false;
        return x.scope.kind === 'dir' || x.scope.kind === 'glob';
      })
      .map(x => ({ ...x, baseName: scopeBaseName(x.scope) }))
      .sort((a, b) => a.baseName.localeCompare(b.baseName) || a.scopeId.localeCompare(b.scopeId));

    const nameCounts = new Map<string, number>();
    for (const entry of scoped) {
      const count = (nameCounts.get(entry.baseName) ?? 0) + 1;
      nameCounts.set(entry.baseName, count);
      const fileName = count === 1 ? entry.baseName : `${entry.baseName}-${count}`;

      const body = joinParts(entry.parts);
      if (body.length === 0) continue;

      files.push({
        path: `.windsurf/rules/${fileName}.md`,
        content: `${scopeHeader(entry.scope)}\n\n${body}\n`,
      });
    }

    files.sort((a, b) => a.path.localeCompare(b.path));
    return { files, warnings, info };
  },
};

