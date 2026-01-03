'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { UamScopeV1Schema } from '@/lib/uam/uamValidate';
import type { UamBlockKindV1, UamScopeV1 } from '@/lib/uam/uamTypes';

const SCOPE_OPTIONS = [
  { value: 'current', label: 'Use selected scope' },
  { value: 'global', label: 'Global scope' },
  { value: 'dir', label: 'Directory scope' },
  { value: 'glob', label: 'Pattern scope' },
] as const;

const KIND_OPTIONS: Array<{ kind: UamBlockKindV1; label: string }> = [
  { kind: 'markdown', label: 'Markdown' },
  { kind: 'checklist', label: 'Checklist' },
  { kind: 'commands', label: 'Commands' },
  { kind: 'dos-donts', label: "Dos/Don'ts" },
  { kind: 'files', label: 'Files' },
];

type ScopeOption = (typeof SCOPE_OPTIONS)[number]['value'];

function scopeLabel(scope: UamScopeV1) {
  if (scope.name && scope.name.trim().length > 0) return scope.name;
  if (scope.kind === 'global') return 'Global';
  if (scope.kind === 'dir') return scope.dir;
  return scope.patterns.join(', ');
}

function normalizeDirValue(value: string) {
  return value.replace(/\\/g, '/').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
}

export type StructuredAssistPanelProps = {
  onClose?: () => void;
};

export function StructuredAssistPanel({ onClose }: StructuredAssistPanelProps) {
  const scopes = useWorkbenchStore((s) => s.uam.scopes);
  const selectedScopeId = useWorkbenchStore((s) => s.selectedScopeId);
  const insertStructuredBlock = useWorkbenchStore((s) => s.insertStructuredBlock);

  const [scopeKind, setScopeKind] = React.useState<ScopeOption>('current');
  const [scopeValue, setScopeValue] = React.useState('');
  const [scopeName, setScopeName] = React.useState('');
  const [blockKind, setBlockKind] = React.useState<UamBlockKindV1>('markdown');
  const [blockTitle, setBlockTitle] = React.useState('');

  const selectedScope = scopes.find((scope) => scope.id === selectedScopeId) ?? scopes[0];
  const currentScopeLabel = selectedScope ? scopeLabel(selectedScope) : 'Global';

  const scopeValidation = React.useMemo(() => {
    if (scopeKind === 'dir') {
      const normalized = normalizeDirValue(scopeValue);
      if (!normalized) return { ok: false, message: 'Enter a directory path.' };
      return { ok: true, message: null };
    }

    if (scopeKind === 'glob') {
      const pattern = scopeValue.trim();
      if (!pattern) return { ok: false, message: 'Enter a glob pattern.' };
      const result = UamScopeV1Schema.safeParse({ id: 'temp', kind: 'glob', patterns: [pattern] });
      if (!result.success) return { ok: false, message: result.error.issues[0]?.message ?? 'Invalid pattern.' };
      return { ok: true, message: null };
    }

    return { ok: true, message: null };
  }, [scopeKind, scopeValue]);

  const handleInsert = () => {
    if (!scopeValidation.ok) return;
    const id = insertStructuredBlock({
      scopeKind,
      scopeValue: scopeValue.trim(),
      scopeName: scopeName.trim(),
      blockKind,
      blockTitle: blockTitle.trim(),
    });
    if (!id) return;
    setScopeValue('');
    setScopeName('');
    setBlockTitle('');
    setScopeKind('current');
    setBlockKind('markdown');
    onClose?.();
  };

  return (
    <div
      className="rounded-mdt-lg border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-3"
      data-testid="structured-assist-panel"
    >
      <div className="flex items-center justify-between">
        <Text size="bodySm" weight="semibold">
          Structured assist
        </Text>
        <Button size="xs" variant="ghost" onClick={onClose} aria-label="Close structured assist">
          Close
        </Button>
      </div>
      <Text size="caption" tone="muted" className="mt-mdt-1">
        Insert a scoped block without changing existing markdown.
      </Text>

      <div className="mt-mdt-3 space-y-mdt-3">
        <div className="space-y-mdt-2">
          <label htmlFor="structured-scope-kind" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
            Scope
          </label>
          <Select
            id="structured-scope-kind"
            value={scopeKind}
            onChange={(event) => setScopeKind(event.target.value as ScopeOption)}
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Text tone="muted" size="bodySm">
            Current: {currentScopeLabel}
          </Text>
        </div>

        {(scopeKind === 'dir' || scopeKind === 'glob') && (
          <div className="space-y-mdt-2">
            <label htmlFor="structured-scope-value" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
              {scopeKind === 'dir' ? 'Directory path' : 'Glob pattern'}
            </label>
            <Input
              id="structured-scope-value"
              value={scopeValue}
              onChange={(event) => setScopeValue(event.target.value)}
              placeholder={scopeKind === 'dir' ? 'src/components' : 'src/**/*.md'}
              size="sm"
            />
            {scopeValidation.message && (
              <div className="text-caption text-mdt-danger">{scopeValidation.message}</div>
            )}
          </div>
        )}

        {scopeKind !== 'current' && (
          <div className="space-y-mdt-2">
            <label htmlFor="structured-scope-name" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
              Scope label (optional)
            </label>
            <Input
              id="structured-scope-name"
              value={scopeName}
              onChange={(event) => setScopeName(event.target.value)}
              placeholder="Marketing site"
              size="sm"
            />
          </div>
        )}

        <div className="space-y-mdt-2">
          <label htmlFor="structured-block-kind" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
            Block kind
          </label>
          <Select
            id="structured-block-kind"
            value={blockKind}
            onChange={(event) => setBlockKind(event.target.value as UamBlockKindV1)}
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.kind} value={option.kind}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-mdt-2">
          <label htmlFor="structured-block-title" className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
            Block title (optional)
          </label>
          <Input
            id="structured-block-title"
            value={blockTitle}
            onChange={(event) => setBlockTitle(event.target.value)}
            placeholder="Setup checklist"
            size="sm"
          />
        </div>

        <div className="flex justify-end gap-mdt-2">
          <Button size="xs" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xs" onClick={handleInsert} disabled={!scopeValidation.ok}>
            Insert block
          </Button>
        </div>
      </div>
    </div>
  );
}
