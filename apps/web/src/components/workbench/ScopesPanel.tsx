'use client';

import React from 'react';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { UamScopeV1Schema } from '@/lib/uam/uamValidate';

function scopeLabel(scope: { kind: string; name?: string; patterns?: string[]; dir?: string }) {
  if (scope.name && scope.name.trim().length > 0) return scope.name;
  if (scope.kind === 'global') return 'Global';
  if (scope.kind === 'dir') return scope.dir ?? 'Directory';
  return (scope.patterns ?? []).join(', ') || 'Glob';
}

export function ScopesPanel() {
  const scopes = useWorkbenchStore(s => s.uam.scopes);
  const blocks = useWorkbenchStore(s => s.uam.blocks);
  const selectedScopeId = useWorkbenchStore(s => s.selectedScopeId);
  const addScope = useWorkbenchStore(s => s.addScope);
  const removeScope = useWorkbenchStore(s => s.removeScope);
  const selectScope = useWorkbenchStore(s => s.selectScope);
  const selectBlock = useWorkbenchStore(s => s.selectBlock);

  const [adding, setAdding] = React.useState(false);
  const [pattern, setPattern] = React.useState('');

  const trimmed = pattern.trim();

  const validation = React.useMemo(() => {
    if (!adding) return { ok: true, message: null as string | null };
    if (trimmed.length === 0) return { ok: false, message: 'Enter a glob pattern.' };

    const duplicate = scopes.some(s => s.kind === 'glob' && (s as { patterns: string[] }).patterns.includes(trimmed));
    if (duplicate) return { ok: false, message: 'That scope already exists.' };

    const result = UamScopeV1Schema.safeParse({ id: 'temp', kind: 'glob', patterns: [trimmed] });
    if (!result.success) return { ok: false, message: result.error.issues[0]?.message ?? 'Invalid glob pattern.' };

    return { ok: true, message: null as string | null };
  }, [adding, trimmed, scopes]);

  const handleSelect = (scopeId: string) => {
    selectScope(scopeId);
    selectBlock(null);
  };

  const handleAdd = () => {
    if (!validation.ok) return;
    const id = addScope({ kind: 'glob', patterns: [trimmed] });
    setPattern('');
    setAdding(false);
    handleSelect(id);
  };

  return (
    <div data-testid="workbench-scopes-panel">
      <div className="mb-mdt-3 flex items-center justify-between">
        <span className="text-caption font-semibold uppercase tracking-wider text-mdt-muted">Scopes</span>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => setAdding(v => !v)}
          aria-label={adding ? 'Cancel add scope' : 'Add scope'}
        >
          {adding ? 'Cancel' : '+ Scope'}
        </Button>
      </div>

      {adding && (
        <div className="mb-mdt-3 space-y-mdt-2">
          <label htmlFor="workbench-scope-pattern" className="sr-only">
            Scope glob pattern
          </label>
          <Input
            id="workbench-scope-pattern"
            name="scopePattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="src/**/*.ts"
            size="sm"
          />
          {validation.message && <div className="text-caption text-mdt-danger">{validation.message}</div>}
          <div className="flex justify-end">
            <Button size="xs" onClick={handleAdd} disabled={!validation.ok}>
              Add
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-mdt-2">
        {scopes.map(scope => {
          const count = blocks.filter(b => b.scopeId === scope.id).length;
          const selected = selectedScopeId === scope.id;
          const removable = scope.kind !== 'global';

          return (
            <div
              key={scope.id}
              className={cn(
                'w-full text-left rounded-mdt-md border px-mdt-2 py-mdt-2 flex items-center gap-mdt-2 transition-colors duration-mdt-fast ease-mdt-standard motion-reduce:transition-none',
                selected ? 'border-mdt-primary bg-mdt-primary/10' : 'border-mdt-border bg-mdt-surface hover:border-mdt-primary-soft'
              )}
            >
              <button
                type="button"
                onClick={() => handleSelect(scope.id)}
                className="flex-1 min-w-0 text-left"
                aria-current={selected ? 'true' : undefined}
              >
                <div className="flex items-center gap-mdt-2">
                  <span className="truncate text-body-sm text-mdt-text">{scopeLabel(scope)}</span>
                  <span className="text-[10px] text-mdt-muted font-mono uppercase">
                    {scope.kind}
                  </span>
                </div>
                <div className="text-caption text-mdt-muted">{count} blocks</div>
              </button>

              {removable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScope(scope.id);
                  }}
                  className="px-mdt-1 text-mdt-muted hover:text-mdt-danger"
                  aria-label="Remove scope"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
