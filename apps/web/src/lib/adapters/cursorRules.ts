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

function normalizeDir(value: string): string {
  const normalized = value.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (normalized === '' || normalized === '.' || normalized === '/') return '';
  return normalized;
}

function yamlQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function renderGlobs(globs: string[]): string {
  const unique = Array.from(new Set(globs.map(g => g.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  if (unique.length === 0) return 'globs: []\n';
  return `globs:\n${unique.map(g => `  - ${yamlQuote(g)}`).join('\n')}\n`;
}

function scopeBaseName(scope: UamScopeV1): string {
  const named = scope.name?.trim();
  if (named && named.length > 0) return slugify(named);

  if (scope.kind === 'global') return 'global';

  if (scope.kind === 'dir') {
    const dir = normalizeDir(scope.dir);
    return slugify(dir.length > 0 ? dir : 'root');
  }

  return slugify(scope.patterns.join(' '));
}

function scopeDescription(scope: UamScopeV1): string {
  const named = scope.name?.trim();
  if (named && named.length > 0) return named;

  if (scope.kind === 'global') return 'Global rules';

  if (scope.kind === 'dir') {
    const dir = normalizeDir(scope.dir);
    return `Rules for ${dir.length > 0 ? dir : 'root'}`;
  }

  const patterns = scope.patterns.map(p => p.trim()).filter(Boolean);
  return `Rules for ${patterns.length > 0 ? patterns.join(', ') : 'glob'}`;
}

function scopeGlobs(scope: UamScopeV1): string[] {
  if (scope.kind === 'global') return ['**/*'];

  if (scope.kind === 'dir') {
    const dir = normalizeDir(scope.dir);
    return [dir.length > 0 ? `${dir}/**` : '**/*'];
  }

  return scope.patterns;
}

function renderCursorRuleFile(meta: { description: string; globs: string[]; alwaysApply: boolean }, bodyParts: string[]): string {
  const frontmatter =
    `---\n` +
    `description: ${yamlQuote(meta.description)}\n` +
    renderGlobs(meta.globs) +
    `alwaysApply: ${meta.alwaysApply ? 'true' : 'false'}\n` +
    `---\n`;

  const body = bodyParts.map(p => p.trimEnd()).filter(Boolean).join('\n\n---\n\n').trimEnd();
  if (body.length === 0) return `${frontmatter}`;
  return `${frontmatter}\n${body}\n`;
}

export const cursorRulesAdapter: Adapter = {
  id: 'cursor-rules',
  version: '1',
  label: 'Cursor Rules',
  description: 'Exports UAM v1 scopes to .cursor/rules/*.mdc files.',
  compile: (uam: UamV1) => {
    const warnings: string[] = [];
    const info: string[] = [];
    const files: CompiledFile[] = [];

    const scopeById = new Map(uam.scopes.map(s => [s.id, s] as const));
    const partsByScopeId = new Map<string, string[]>();

    for (const block of uam.blocks) {
      const scope = scopeById.get(block.scopeId);
      if (!scope) {
        warnings.push(`Block '${block.id}' references unknown scopeId '${block.scopeId}'. Skipped.`);
        continue;
      }

      const parts = partsByScopeId.get(scope.id) ?? [];
      parts.push(block.body.trimEnd());
      partsByScopeId.set(scope.id, parts);
    }

    const entries = Array.from(partsByScopeId.entries())
      .map(([scopeId, parts]) => ({ scopeId, parts, scope: scopeById.get(scopeId) }))
      .filter((x): x is { scopeId: string; parts: string[]; scope: UamScopeV1 } => Boolean(x.scope))
      .map(x => ({ ...x, baseName: scopeBaseName(x.scope) }))
      .sort((a, b) => a.baseName.localeCompare(b.baseName) || a.scopeId.localeCompare(b.scopeId));

    const nameCounts = new Map<string, number>();
    for (const entry of entries) {
      const count = (nameCounts.get(entry.baseName) ?? 0) + 1;
      nameCounts.set(entry.baseName, count);
      const fileName = count === 1 ? entry.baseName : `${entry.baseName}-${count}`;

      files.push({
        path: `.cursor/rules/${fileName}.mdc`,
        content: renderCursorRuleFile(
          {
            description: scopeDescription(entry.scope),
            globs: scopeGlobs(entry.scope),
            alwaysApply: entry.scope.kind === 'global',
          },
          entry.parts
        ),
      });
    }

    files.sort((a, b) => a.path.localeCompare(b.path));
    return { files, warnings, info };
  },
};

