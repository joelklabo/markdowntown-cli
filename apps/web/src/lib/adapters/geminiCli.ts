import type { Adapter, CompiledFile } from './types';
import type { UamScopeV1, UamTargetV1, UamV1 } from '../uam/uamTypes';

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.length > 0 ? slug : 'scope';
}

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (normalized === '' || normalized === '.' || normalized === '/') return '';
  return normalized;
}

function scopeLabel(scope: Extract<UamScopeV1, { kind: 'dir' | 'glob' }>): string {
  if (scope.kind === 'dir') {
    const dir = normalizePath(scope.dir);
    return dir.length > 0 ? dir : 'root';
  }

  const patterns = scope.patterns.join(', ').trim();
  return patterns.length > 0 ? patterns : 'glob';
}

function scopeBaseName(scope: Extract<UamScopeV1, { kind: 'dir' | 'glob' }>): string {
  const named = scope.name?.trim();
  if (named && named.length > 0) return slugify(named);

  if (scope.kind === 'dir') {
    const dir = normalizePath(scope.dir);
    return slugify(dir.length > 0 ? dir : 'root');
  }

  return slugify(scope.patterns.join(' '));
}

type GeminiCompileConfig = {
  modular: boolean;
  scopeDir: string;
};

function parseCompileConfig(target?: UamTargetV1): GeminiCompileConfig {
  const options = (target?.options ?? {}) as Record<string, unknown>;

  const modular =
    options.modular === true ||
    options.splitScopes === true ||
    (typeof options.mode === 'string' && options.mode.toLowerCase() === 'modular');

  const scopeDirRaw = typeof options.scopeDir === 'string' ? options.scopeDir : '.gemini/scopes';
  const normalized = normalizePath(scopeDirRaw);
  const scopeDir = normalized.length > 0 ? normalized : '.gemini/scopes';

  return { modular, scopeDir };
}

function joinParts(parts: string[]): string {
  return parts.map(p => p.trimEnd()).filter(Boolean).join('\n\n---\n\n').trimEnd();
}

function renderScopeFile(scope: Extract<UamScopeV1, { kind: 'dir' | 'glob' }>, parts: string[]): string {
  const body = joinParts(parts);
  const label = scopeLabel(scope);
  if (body.length === 0) return `# Scope: ${label}\n`;
  return `# Scope: ${label}\n\n${body}\n`;
}

export const geminiCliAdapter: Adapter = {
  id: 'gemini-cli',
  version: '1',
  label: 'Gemini CLI',
  description: 'Exports UAM v1 to GEMINI.md with optional @path includes.',
  compile: (uam: UamV1, target?: UamTargetV1) => {
    const warnings: string[] = [];
    const info: string[] = [];
    const files: CompiledFile[] = [];

    const { modular, scopeDir } = parseCompileConfig(target);

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

    const scoped = Array.from(scopedPartsByScopeId.entries())
      .map(([scopeId, parts]) => ({ scopeId, parts, scope: scopeById.get(scopeId) }))
      .filter((x): x is { scopeId: string; parts: string[]; scope: Extract<UamScopeV1, { kind: 'dir' | 'glob' }> } => {
        if (!x.scope) return false;
        return x.scope.kind === 'dir' || x.scope.kind === 'glob';
      })
      .map(x => ({ ...x, baseName: scopeBaseName(x.scope) }))
      .sort((a, b) => a.baseName.localeCompare(b.baseName) || a.scopeId.localeCompare(b.scopeId));

    for (const entry of scoped) {
      warnings.push(
        `Scope '${scopeLabel(entry.scope)}' cannot be enforced in GEMINI.md. Exported content will apply globally (lossy).`
      );
    }

    if (modular) {
      const nameCounts = new Map<string, number>();
      const includeLines: string[] = [];

      for (const entry of scoped) {
        const count = (nameCounts.get(entry.baseName) ?? 0) + 1;
        nameCounts.set(entry.baseName, count);
        const fileName = count === 1 ? entry.baseName : `${entry.baseName}-${count}`;
        const path = `${scopeDir}/${fileName}.md`;

        files.push({
          path,
          content: renderScopeFile(entry.scope, entry.parts),
        });
        includeLines.push(`@${path}`);
      }

      const rootParts: string[] = [];
      const global = joinParts(globalParts);
      if (global.length > 0) rootParts.push(global);
      if (includeLines.length > 0) rootParts.push(includeLines.join('\n'));

      files.push({
        path: 'GEMINI.md',
        content: rootParts.filter(Boolean).join('\n\n---\n\n').trimEnd() + (rootParts.length > 0 ? '\n' : ''),
      });
    } else {
      const sections: string[] = [];
      const global = joinParts(globalParts);
      if (global.length > 0) sections.push(global);

      for (const entry of scoped) {
        const body = joinParts(entry.parts);
        if (body.length === 0) continue;
        sections.push(`## Scope: ${scopeLabel(entry.scope)}\n\n${body}`);
      }

      files.push({
        path: 'GEMINI.md',
        content: sections.filter(Boolean).join('\n\n---\n\n').trimEnd() + (sections.length > 0 ? '\n' : ''),
      });
    }

    files.sort((a, b) => a.path.localeCompare(b.path));
    return { files, warnings, info };
  },
};

