'use client';

import React, { useMemo } from 'react';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { lintUamV1, type UamLintWarning } from '@/lib/uam/uamLint';
import type { UamScopeV1 } from '@/lib/uam/uamTypes';
import { Button } from '@/components/ui/Button';

function normalizeDir(dir: string): string {
  const normalized = dir.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
  if (normalized === '' || normalized === '.' || normalized === '/') return '';
  return normalized;
}

function scopeTitle(scope: UamScopeV1 | null | undefined): string {
  if (!scope || scope.kind === 'global') return 'Global';
  if (scope.kind === 'dir') {
    const dir = normalizeDir(scope.dir);
    return dir.length > 0 ? dir : 'root';
  }
  const patterns = scope.patterns.join(', ').trim();
  return patterns.length > 0 ? patterns : 'glob';
}

type WarningGroup = { scopeId: string | null; title: string; warnings: UamLintWarning[] };

export function LintPanel() {
  const uam = useWorkbenchStore(s => s.uam);

  const warnings = useMemo(() => lintUamV1(uam), [uam]);
  const groups = useMemo<WarningGroup[]>(() => {
    const scopeById = new Map(uam.scopes.map(s => [s.id, s] as const));
    const grouped = new Map<string | null, UamLintWarning[]>();

    for (const w of warnings) {
      const key = w.scopeId ?? null;
      const list = grouped.get(key) ?? [];
      list.push(w);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries())
      .map(([scopeId, warnings]) => ({
        scopeId,
        title: scopeTitle(scopeId ? scopeById.get(scopeId) : null),
        warnings,
      }))
      .sort((a, b) => a.title.localeCompare(b.title) || String(a.scopeId).localeCompare(String(b.scopeId)));
  }, [uam.scopes, warnings]);

  if (warnings.length === 0) {
    return (
      <div className="rounded-mdt-lg border border-dashed border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3 text-body-sm text-mdt-muted">
        No lint warnings.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto space-y-mdt-4 p-mdt-4">
      {groups.map((group) => (
        <div key={group.scopeId ?? 'global'} className="overflow-hidden rounded-mdt-lg border border-mdt-border bg-mdt-surface shadow-mdt-sm">
          <div className="flex items-center justify-between gap-mdt-2 border-b border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3">
            <div className="text-caption font-semibold uppercase tracking-wide text-mdt-text">{group.title}</div>
            <div className="text-caption text-mdt-muted">{group.warnings.length} warning(s)</div>
          </div>

          <ul className="divide-y divide-mdt-border">
            {group.warnings.map((w, idx) => (
              <li key={`${w.code}:${idx}`} className="flex flex-col gap-mdt-2 p-mdt-3 sm:flex-row sm:items-start sm:justify-between sm:gap-mdt-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-mdt-muted uppercase tracking-wide">{w.code}</div>
                  <div className="text-body-sm text-mdt-text break-words">{w.message}</div>
                </div>
                <Button size="xs" variant="secondary" disabled title="Fix actions coming soon" className="w-fit">
                  {w.fix ? w.fix.label : 'Fix (stub)'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
