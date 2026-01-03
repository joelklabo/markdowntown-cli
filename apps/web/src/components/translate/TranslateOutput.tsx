'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Heading } from '@/components/ui/Heading';
import { Input } from '@/components/ui/Input';
import { Stack, Row } from '@/components/ui/Stack';
import { Surface } from '@/components/ui/Surface';
import { Text } from '@/components/ui/Text';
import { TextArea } from '@/components/ui/TextArea';
import { DEFAULT_ADAPTER_VERSION, type UamTargetV1 } from '@/lib/uam/uamTypes';

export interface TranslateCompiledFile {
  path: string;
  content: string;
}

export interface TranslateCompileResult {
  files: TranslateCompiledFile[];
  warnings: string[];
  info: string[];
}

interface TranslateOutputProps {
  targets: UamTargetV1[];
  onToggleTarget: (targetId: string) => void;
  onUpdateTarget: (targetId: string, patch: Partial<Omit<UamTargetV1, 'targetId'>>) => void;
  onCompile: () => void;
  onDownloadZip: () => void;
  onOpenWorkbench: () => void;
  loading: boolean;
  error: string | null;
  detectedLabel: string;
  disabledCompile: boolean;
  result: TranslateCompileResult | null;
}

export function TranslateOutput({
  targets,
  onToggleTarget,
  onUpdateTarget,
  onCompile,
  onDownloadZip,
  onOpenWorkbench,
  loading,
  error,
  detectedLabel,
  disabledCompile,
  result,
}: TranslateOutputProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [optionsErrors, setOptionsErrors] = useState<Record<string, string>>({});
  const hasResult = Boolean(result);
  const hasFiles = (result?.files.length ?? 0) > 0;
  const compileDisabled = disabledCompile || loading || targets.length === 0;
  const readyForWorkbench = hasResult && hasFiles && !error;
  const showResult = !error ? result : null;

  const byId = new Map(targets.map((t) => [t.targetId, t] as const));

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  return (
    <Stack gap={4} className="h-full">
      <Surface padding="lg" className="space-y-mdt-4">
        <div className="flex flex-wrap items-start justify-between gap-mdt-3">
          <div className="space-y-mdt-1">
            <Text size="caption" tone="muted">Step 1 · Targets</Text>
            <Heading level="h3" as="h2">Select targets</Heading>
            <Text size="bodySm" tone="muted">
              Choose targets to generate files, then open in Workbench to refine and export.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-mdt-2">
            <Badge tone="info">Detected: {detectedLabel}</Badge>
            {targets.length === 0 ? <Badge tone="warning">Select a target</Badge> : null}
          </div>
        </div>

        <Surface tone="subtle" padding="md" className="space-y-mdt-3" data-testid="translate-actions">
          <div className="flex flex-wrap items-center justify-between gap-mdt-2">
            <Text size="caption" tone="muted" className="uppercase tracking-wide">
              Targets
            </Text>
            {targets.length > 0 ? (
              <Text size="caption" tone="muted">
                {targets.length} selected
              </Text>
            ) : null}
          </div>
          <Row gap={4} align="center" className="flex-wrap">
            <Checkbox checked={byId.has('agents-md')} onChange={() => onToggleTarget('agents-md')}>
              <span className="inline-flex items-center gap-2">
                <span>AGENTS.md</span>
                {byId.get('agents-md') ? (
                  <Text as="span" size="caption" tone="muted" className="font-mono">
                    v{byId.get('agents-md')!.adapterVersion}
                  </Text>
                ) : null}
              </span>
            </Checkbox>
            <Checkbox checked={byId.has('github-copilot')} onChange={() => onToggleTarget('github-copilot')}>
              <span className="inline-flex items-center gap-2">
                <span>GitHub Copilot</span>
                {byId.get('github-copilot') ? (
                  <Text as="span" size="caption" tone="muted" className="font-mono">
                    v{byId.get('github-copilot')!.adapterVersion}
                  </Text>
                ) : null}
              </span>
            </Checkbox>
          </Row>
          <Text size="caption" tone="muted">
            Advanced options let you fine-tune adapter versions and target-specific settings.
          </Text>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced ? 'Hide advanced options' : 'Advanced options'}
          </Button>

          {showAdvanced && targets.length > 0 ? (
            <Surface tone="subtle" padding="md" className="space-y-mdt-3">
              {targets.map((target) => {
                const adapterId = `translate-${target.targetId}-adapter`;
                const optionsId = `translate-${target.targetId}-options`;
                return (
                <Surface key={target.targetId} padding="md" className="space-y-mdt-3">
                  <div className="flex flex-wrap items-center justify-between gap-mdt-3">
                    <Text size="bodySm" weight="semibold" className="font-mono">
                      {target.targetId}
                    </Text>
                    <div className="flex items-center gap-mdt-2">
                      <Text as="label" htmlFor={adapterId} size="caption" tone="muted">
                        Adapter
                      </Text>
                      <Input
                        id={adapterId}
                        name={adapterId}
                        size="sm"
                        value={target.adapterVersion}
                        onChange={(e) => {
                          const next = e.target.value.trim();
                          onUpdateTarget(target.targetId, { adapterVersion: next.length > 0 ? next : DEFAULT_ADAPTER_VERSION });
                        }}
                        className="w-24 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-mdt-2">
                    <Text as="label" htmlFor={optionsId} size="caption" tone="muted">
                      Options (JSON)
                    </Text>
                    <TextArea
                      id={optionsId}
                      name={optionsId}
                      defaultValue={JSON.stringify(target.options ?? {}, null, 2)}
                      rows={4}
                      className="font-mono text-body-sm"
                      onBlur={(e) => {
                        const text = e.target.value.trim();
                        try {
                          const parsed = text.length === 0 ? {} : JSON.parse(text);
                          if (!isRecord(parsed)) throw new Error('Options must be an object');
                          onUpdateTarget(target.targetId, { options: parsed });
                          setOptionsErrors((prev) => {
                            const next = { ...prev };
                            delete next[target.targetId];
                            return next;
                          });
                        } catch {
                          setOptionsErrors((prev) => ({ ...prev, [target.targetId]: 'Invalid JSON options' }));
                        }
                      }}
                    />
                    {optionsErrors[target.targetId] ? (
                      <Text size="caption" className="text-[color:var(--mdt-color-danger)]">
                        {optionsErrors[target.targetId]}
                      </Text>
                    ) : null}
                  </div>
                </Surface>
              );
              })}
            </Surface>
          ) : null}
        </Surface>

        <Surface tone="subtle" padding="md" className="space-y-mdt-3">
          <Text size="caption" tone="muted" className="uppercase tracking-wide">
            Step 3 · Compile + open in Workbench
          </Text>
          {error ? (
            <div className="space-y-mdt-2 rounded-mdt-md border border-[color:var(--mdt-color-danger-soft)] bg-[color:var(--mdt-color-danger-soft)]/40 px-mdt-3 py-mdt-3">
              <Text size="bodySm" className="text-[color:var(--mdt-color-danger)]">
                {error}
              </Text>
              <Button onClick={onCompile} disabled={compileDisabled} variant="primary" size="sm">
                {loading ? 'Compiling…' : 'Try compile again'}
              </Button>
            </div>
          ) : readyForWorkbench ? (
            <div className="space-y-mdt-3 rounded-mdt-md border border-[color:var(--mdt-color-success-soft)] bg-[color:var(--mdt-color-success-soft)]/40 px-mdt-3 py-mdt-3">
              <div className="space-y-mdt-1">
                <Text size="bodySm" weight="semibold">
                  Ready for Workbench
                </Text>
                <Text size="caption" tone="muted">
                  Open a fresh Workbench draft in a new tab. Keep this page open so you can copy or download the compiled files
                  into Workbench.
                </Text>
              </div>
              <Row gap={2} align="center" wrap data-testid="translate-ready-actions">
                <Button size="sm" asChild>
                  <Link href="/workbench" target="_blank" rel="noreferrer noopener" onClick={onOpenWorkbench}>
                    Open in Workbench
                  </Link>
                </Button>
                <Button
                  onClick={onDownloadZip}
                  disabled={!result || result.files.length === 0}
                  variant="secondary"
                  size="sm"
                >
                  Download zip
                </Button>
                <Button onClick={onCompile} disabled={compileDisabled} variant="ghost" size="sm">
                  Recompile
                </Button>
              </Row>
            </div>
          ) : (
            <Row gap={2} align="center" wrap>
              <Button
                onClick={onCompile}
                disabled={compileDisabled}
                variant="primary"
                size="sm"
                data-testid="translate-compile"
              >
                {loading ? 'Compiling…' : 'Compile files'}
              </Button>
              <Button onClick={onDownloadZip} disabled={!result || result.files.length === 0} variant="secondary" size="sm">
                Download zip
              </Button>
            </Row>
          )}
          <Text size="caption" tone="muted">
            Compile generates instruction files you can copy or download before opening Workbench to refine and export.
          </Text>
        </Surface>
      </Surface>

      <Surface padding="lg" className="space-y-mdt-4">
        <div className="flex flex-wrap items-center justify-between gap-mdt-3">
          <Heading level="h3" as="h2">Results</Heading>
          {showResult ? (
            <Text size="caption" tone="muted">
              {showResult.files.length} file{showResult.files.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </div>

        {showResult ? (
          <Stack gap={3}>
            {showResult.warnings.length > 0 && (
              <div className="rounded-mdt-md border border-[color:var(--mdt-color-warning-soft)] bg-[color:var(--mdt-color-warning-soft)]/50 p-mdt-3">
                <Text size="caption" weight="semibold" className="text-[color:var(--mdt-color-warning)]">
                  Warnings
                </Text>
                <ul className="mt-mdt-2 list-disc space-y-mdt-1 pl-mdt-5">
                  {showResult.warnings.map((w, i) => (
                    <Text as="li" key={i} size="bodySm" className="text-[color:var(--mdt-color-warning)]">
                      {w}
                    </Text>
                  ))}
                </ul>
              </div>
            )}

            {showResult.info.length > 0 && (
              <div className="rounded-mdt-md border border-[color:var(--mdt-color-info-soft)] bg-[color:var(--mdt-color-info-soft)]/45 p-mdt-3">
                <Text size="caption" weight="semibold" className="text-[color:var(--mdt-color-info)]">
                  Info
                </Text>
                <ul className="mt-mdt-2 list-disc space-y-mdt-1 pl-mdt-5">
                  {showResult.info.map((infoItem, idx) => (
                    <Text as="li" key={idx} size="bodySm" className="text-[color:var(--mdt-color-info)]">
                      {infoItem}
                    </Text>
                  ))}
                </ul>
              </div>
            )}

            {showResult.files.length === 0 && showResult.warnings.length === 0 && (
              <Text size="bodySm" tone="muted">
                No files generated yet. Adjust your targets or input and compile again.
              </Text>
            )}

            {showResult.files.map((f) => (
              <Surface key={f.path} padding="none" className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-mdt-2 border-b border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2">
                  <Text size="caption" tone="muted" className="font-mono">
                    {f.path}
                  </Text>
                  <Row gap={2} align="center">
                    {copiedPath === f.path && (
                      <Text size="caption" tone="muted">
                        Copied
                      </Text>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(f.content);
                          setCopiedPath(f.path);
                          setTimeout(() => setCopiedPath(null), 1000);
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      Copy
                    </Button>
                  </Row>
                </div>
                <pre className="whitespace-pre-wrap px-mdt-3 py-mdt-3 font-mono text-body-sm text-mdt-text">{f.content}</pre>
              </Surface>
            ))}
          </Stack>
        ) : (
          <div className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-4">
            <Text size="bodySm" tone="muted">
              No output yet.
            </Text>
            <Text size="caption" tone="muted">
              Select targets and press Compile to generate files.
            </Text>
          </div>
        )}
      </Surface>
    </Stack>
  );
}
