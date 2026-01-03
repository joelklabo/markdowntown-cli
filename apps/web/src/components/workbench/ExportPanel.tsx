'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FileTree } from '@/components/ui/FileTree';
import { Input } from '@/components/ui/Input';
import { Radio } from '@/components/ui/Radio';
import { Text } from '@/components/ui/Text';
import { TextArea } from '@/components/ui/TextArea';
import { createZip } from '@/lib/compile/zip';
import { getTimeSinceSessionStartMs, track, trackSkillExportAction, trackSkillExportConfig } from '@/lib/analytics';
import { applySkillExportSelection, getSkillExportSelection, type SkillExportSelection } from '@/lib/skills/skillExport';
import { CompatibilityMatrix } from '@/components/workbench/CompatibilityMatrix';
import { DiffPreview } from '@/components/workbench/DiffPreview';
import { buildCompatibilityMatrix } from '@/lib/uam/compatibility';
import {
  DEFAULT_ADAPTER_VERSION,
  createUamTargetV1,
  type UamScopeV1,
  type UamTargetV1,
  type UamV1,
} from '@/lib/uam/uamTypes';
import { emitCityWordmarkEvent } from '@/components/wordmark/sim/bridge';
import type { WorkbenchEntrySource } from '@/components/workbench/workbenchEntry';

const COMPILE_DEBOUNCE_MS = 250;

const TARGETS: Array<{ targetId: string; label: string }> = [
  { targetId: 'agents-md', label: 'AGENTS.md' },
  { targetId: 'github-copilot', label: 'GitHub Copilot' },
  { targetId: 'claude-code', label: 'Claude Code' },
  { targetId: 'gemini-cli', label: 'Gemini CLI' },
];

const SKILL_EXPORT_TARGETS = new Set(['agents-md', 'github-copilot', 'claude-code']);

function hasTarget(targets: UamTargetV1[], targetId: string) {
  return targets.some(t => t.targetId === targetId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scopeLabel(scope: UamScopeV1): string {
  if (scope.name && scope.name.trim().length > 0) return scope.name;
  if (scope.kind === 'global') return 'Global';
  if (scope.kind === 'dir') return scope.dir;
  return scope.patterns.join(', ');
}

function blockLabel(block: { kind: string; title?: string }) {
  const title = block.title?.trim();
  if (title && title.length > 0) return title;
  return block.kind.toUpperCase();
}

function renderScopeMarkdown(scope: UamScopeV1, blocks: Array<{ kind: string; title?: string; body: string }>): string {
  const header = scope.kind === 'global' ? '## Global' : `## ${scopeLabel(scope)}`;

  if (blocks.length === 0) return `${header}\n\n_(no blocks)_`;

  const renderedBlocks = blocks.map((b) => {
    const title = blockLabel(b);
    const body = b.body.trimEnd();
    return `### ${title}\n\n${body.length > 0 ? body : '_(empty)_'}`;
  });

  return `${header}\n\n${renderedBlocks.join('\n\n---\n\n')}`;
}

function buildRawPreview(uam: UamV1): string {
  const header = `# ${uam.meta.title}${uam.meta.description ? `\n\n${uam.meta.description}` : ''}`;
  const sections = uam.scopes.map((scope) => {
    const scoped = uam.blocks.filter((block) => block.scopeId === scope.id);
    return renderScopeMarkdown(scope, scoped);
  });
  return `${header}\n\n${sections.join('\n\n---\n\n')}`.trimEnd();
}

type ExportPanelProps = {
  entrySource?: WorkbenchEntrySource;
};

export function ExportPanel({ entrySource = 'direct' }: ExportPanelProps) {
  const uam = useWorkbenchStore(s => s.uam);
  const setUam = useWorkbenchStore(s => s.setUam);
  const result = useWorkbenchStore(s => s.compilationResult);
  const setCompilationResult = useWorkbenchStore(s => s.setCompilationResult);
  const skills = useWorkbenchStore(s => s.skills);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<Date | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewMode, setPreviewMode] = useState<'raw' | 'diff'>('raw');
  const [optionsErrors, setOptionsErrors] = useState<Record<string, string>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUamRef = useRef<UamV1 | null>(null);
  const requestIdRef = useRef(0);

  const targetIds = useMemo(() => uam.targets.map(t => t.targetId), [uam.targets]);
  const manifestPaths = useMemo(() => result?.files.map(f => f.path) ?? [], [result]);
  const exportReady = useMemo(() => (result?.files?.length ?? 0) > 0, [result]);
  const primaryTargetLabel = useMemo(() => {
    if (targetIds.length !== 1) return null;
    const target = TARGETS.find((item) => item.targetId === targetIds[0]);
    return target?.label ?? targetIds[0];
  }, [targetIds]);
  const exportLabel = useMemo(() => {
    if (primaryTargetLabel) return `Export ${primaryTargetLabel}`;
    if (targetIds.length > 1) return `Export ${targetIds.length} targets`;
    return 'Export outputs';
  }, [primaryTargetLabel, targetIds.length]);
  const exportStatus = useMemo(() => {
    if (exportedAt) {
      return primaryTargetLabel
        ? `Export complete. ${primaryTargetLabel} is ready.`
        : 'Export complete. Your files are ready.';
    }
    if (loading) return 'Compiling for export…';
    if (result?.files?.length) {
      const count = result.files.length;
      return `Ready to export ${count} file${count === 1 ? '' : 's'}.`;
    }
    if (targetIds.length === 0) return 'Select at least one target to compile outputs.';
    return 'Compile to preview outputs.';
  }, [exportedAt, loading, primaryTargetLabel, result, targetIds.length]);
  const entryLabel = useMemo(() => {
    switch (entrySource) {
      case 'scan':
        return 'Scan defaults applied';
      case 'library':
        return 'Library item loaded';
      case 'translate':
        return 'Translation ready';
      default:
        return 'Start in Workbench';
    }
  }, [entrySource]);
  const nextStep = useMemo(() => {
    if (targetIds.length === 0) return 'Select at least one target to compile.';
    if (loading) return 'Compiling outputs…';
    if (exportReady) return 'Export your files when ready.';
    return 'Compile to preview outputs.';
  }, [exportReady, loading, targetIds.length]);
  const rawPreview = useMemo(() => buildRawPreview(uam), [uam]);
  const compatibility = useMemo(() => buildCompatibilityMatrix(uam, uam.targets), [uam]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const compileNow = async (uamToCompile: UamV1) => {
    const requestId = ++requestIdRef.current;

    try {
      setError(null);

      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uam: uamToCompile, targets: uamToCompile.targets }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error ?? `Compilation failed (${res.status})`;
        throw new Error(message);
      }

      const data = await res.json();
      if (requestId !== requestIdRef.current) return;
      setCompilationResult(data);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      setCompilationResult(null);
      setError(err instanceof Error ? err.message : 'Error compiling');
      emitCityWordmarkEvent({ type: 'alert', kind: 'ambulance' });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const cancelPendingCompile = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    pendingUamRef.current = null;
    requestIdRef.current++;
    setLoading(false);
  };

  const scheduleCompile = (nextUam: UamV1) => {
    if (nextUam.targets.length === 0) {
      cancelPendingCompile();
      return;
    }

    pendingUamRef.current = nextUam;
    setLoading(true);
    setExportedAt(null);
    emitCityWordmarkEvent({ type: 'publish', kind: 'artifact' });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const pending = pendingUamRef.current ?? nextUam;
      pendingUamRef.current = null;
      void compileNow(pending);
    }, COMPILE_DEBOUNCE_MS);
  };

  const toggleTarget = (targetId: string) => {
    const nextTargets = hasTarget(uam.targets, targetId)
      ? uam.targets.filter(t => t.targetId !== targetId)
      : [...uam.targets, createUamTargetV1(targetId)];

    setExportedAt(null);
    const nextUam = { ...uam, targets: nextTargets };
    setUam(nextUam);
  };

  const updateTarget = (targetId: string, patch: Partial<Omit<UamTargetV1, 'targetId'>>) => {
    const nextTargets = uam.targets.map((target) => (target.targetId === targetId ? { ...target, ...patch } : target));
    setExportedAt(null);
    setUam({ ...uam, targets: nextTargets });
  };

  const updateSkillSelection = (targetId: string, selection: SkillExportSelection) => {
    const target = uam.targets.find((t) => t.targetId === targetId);
    if (!target) return;
    const options = applySkillExportSelection(target.options ?? {}, selection);
    updateTarget(targetId, { options });
    trackSkillExportConfig({
      targetId,
      mode: selection.mode,
      allowListCount: selection.allowList.length,
      totalSkills: skills.length,
    });
  };

  const handleDownload = async () => {
    if (!result || result.files.length === 0) return;
    try {
      emitCityWordmarkEvent({ type: 'publish', kind: 'file' });
      const blob = await createZip(result.files);
      setExportedAt(new Date());
      const timeToExportMs =
        typeof getTimeSinceSessionStartMs === 'function' ? getTimeSinceSessionStartMs() : undefined;
      const timing = timeToExportMs === undefined ? {} : { time_to_export_ms: timeToExportMs };
      track('workbench_export_download', {
        targetIds,
        fileCount: result.files.length,
        entrySource,
        ...timing,
      });
      trackSkillExportAction({
        action: 'download',
        targetIds,
        skillCount: uam.capabilities.length,
        entrySource,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'outputs.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating zip');
      emitCityWordmarkEvent({ type: 'alert', kind: 'ambulance' });
    }
  };

  return (
    <div id="workbench-export-panel" tabIndex={-1} className="h-full overflow-auto space-y-mdt-4 p-mdt-4">
      <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
        <Text size="caption" tone="muted">
          {entryLabel}
        </Text>
        <Text size="bodySm" tone="muted">
          Next step: {nextStep}
        </Text>
      </div>
      <div>
        <fieldset className="space-y-mdt-2 border-0 p-0">
          <legend className="mb-mdt-2 text-caption font-semibold uppercase tracking-wide text-mdt-muted">
            Targets
          </legend>
          <div className="space-y-mdt-2">
            {TARGETS.map((t) => {
              const selected = uam.targets.find((target) => target.targetId === t.targetId) ?? null;
              return (
                <Checkbox
                  key={t.targetId}
                  id={`workbench-target-${t.targetId}`}
                  name={`workbench-target-${t.targetId}`}
                  checked={targetIds.includes(t.targetId)}
                  onChange={() => toggleTarget(t.targetId)}
                >
                  <span className="inline-flex items-center gap-mdt-2">
                    <span>{t.label}</span>
                    {selected ? (
                      <span aria-hidden className="font-mono text-[11px] text-mdt-muted">
                        v{selected.adapterVersion}
                      </span>
                    ) : null}
                  </span>
                </Checkbox>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          className="mt-mdt-2 text-caption text-mdt-muted underline underline-offset-4"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced'}
        </button>

        {showAdvanced && uam.targets.length > 0 ? (
          <div className="mt-mdt-3 space-y-mdt-3 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
            {uam.targets.map((target) => {
              const adapterId = `workbench-${target.targetId}-adapter`;
              const optionsId = `workbench-${target.targetId}-options`;
              const optionsErrorId = `workbench-${target.targetId}-options-error`;
              const skillsOffId = `skills-${target.targetId}-off`;
              const skillsAllId = `skills-${target.targetId}-all`;
              const skillsAllowId = `skills-${target.targetId}-allowlist`;
              const skillSelection = getSkillExportSelection(target);
              const supportsSkillExport = SKILL_EXPORT_TARGETS.has(target.targetId);
              return (
                <div
                  key={target.targetId}
                  data-testid={`export-target-${target.targetId}`}
                  className="space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface p-mdt-3"
                >
                <div className="flex flex-wrap items-center gap-mdt-3">
                  <div className="font-mono text-caption text-mdt-text">{target.targetId}</div>
                  <div className="flex items-center gap-mdt-2">
                    <label htmlFor={adapterId} className="text-caption text-mdt-muted">
                      Adapter
                    </label>
                    <Input
                      id={adapterId}
                      name={adapterId}
                      size="sm"
                      value={target.adapterVersion}
                      onChange={(e) => {
                        const next = e.target.value.trim();
                        updateTarget(target.targetId, { adapterVersion: next.length > 0 ? next : DEFAULT_ADAPTER_VERSION });
                      }}
                      className="w-20 font-mono"
                      aria-label={`Adapter version for ${target.targetId}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={optionsId} className="mb-mdt-1 text-caption text-mdt-muted">
                    Options (JSON)
                  </label>
                  <TextArea
                    key={`${optionsId}:${JSON.stringify(target.options ?? {})}`}
                    id={optionsId}
                    name={optionsId}
                    defaultValue={JSON.stringify(target.options ?? {}, null, 2)}
                    rows={4}
                    className="font-mono text-xs"
                    aria-describedby={optionsErrors[target.targetId] ? optionsErrorId : undefined}
                    aria-invalid={Boolean(optionsErrors[target.targetId])}
                    onBlur={(e) => {
                      const text = e.target.value.trim();
                      try {
                        const parsed = text.length === 0 ? {} : JSON.parse(text);
                        if (!isRecord(parsed)) throw new Error('Options must be an object');
                        updateTarget(target.targetId, { options: parsed });
                        setOptionsErrors((prev) => {
                          const next = { ...prev };
                          delete next[target.targetId];
                          return next;
                        });
                      } catch {
                        setOptionsErrors((prev) => ({ ...prev, [target.targetId]: 'Invalid JSON options' }));
                      }
                    }}
                    aria-label={`Options for ${target.targetId}`}
                  />
                  {optionsErrors[target.targetId] ? (
                    <div
                      id={optionsErrorId}
                      className="mt-mdt-1 text-caption text-[color:var(--mdt-color-danger)]"
                    >
                      {optionsErrors[target.targetId]}
                    </div>
                  ) : null}
                </div>

                {supportsSkillExport ? (
                  <fieldset className="space-y-mdt-2 border-0 p-0" data-testid={`skills-export-${target.targetId}`}>
                    <legend className="text-caption text-mdt-muted">Skills export</legend>
                    <div className="flex flex-wrap gap-mdt-3">
                      <Radio
                        id={skillsOffId}
                        name={`skills-${target.targetId}`}
                        checked={skillSelection.mode === 'off'}
                        onChange={() => updateSkillSelection(target.targetId, { mode: 'off', allowList: [] })}
                        label="Off"
                      />
                      <Radio
                        id={skillsAllId}
                        name={`skills-${target.targetId}`}
                        checked={skillSelection.mode === 'all'}
                        onChange={() => updateSkillSelection(target.targetId, { mode: 'all', allowList: [] })}
                        label="All skills"
                      />
                      <Radio
                        id={skillsAllowId}
                        name={`skills-${target.targetId}`}
                        checked={skillSelection.mode === 'allowlist'}
                        onChange={() => updateSkillSelection(target.targetId, { mode: 'allowlist', allowList: skillSelection.allowList })}
                        label="Allowlist"
                      />
                    </div>

                    {skillSelection.mode === 'allowlist' ? (
                      <div className="space-y-mdt-1 rounded-mdt-sm border border-mdt-border bg-mdt-surface-subtle p-mdt-2">
                        {skills.length === 0 ? (
                          <div className="text-caption text-mdt-muted">
                            Add skills in the Workbench to build an allowlist.
                          </div>
                        ) : (
                          skills.map((skill) => {
                            const checked = skillSelection.allowList.includes(skill.id);
                            const allowlistId = `skill-allowlist-${target.targetId}-${skill.id.replace(/[^a-z0-9_-]+/gi, '-')}`;
                            return (
                              <Checkbox
                                key={skill.id}
                                id={allowlistId}
                                name={allowlistId}
                                checked={checked}
                                onChange={() => {
                                  const nextAllowList = checked
                                    ? skillSelection.allowList.filter((id) => id !== skill.id)
                                    : [...skillSelection.allowList, skill.id];
                                  updateSkillSelection(target.targetId, { mode: 'allowlist', allowList: nextAllowList });
                                }}
                              >
                                <span className="flex flex-col">
                                  <span>{skill.title?.trim() || skill.id}</span>
                                  <span className="text-caption font-mono text-mdt-muted">{skill.id}</span>
                                </span>
                              </Checkbox>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </fieldset>
                ) : null}
              </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {compatibility.targets.length > 0 && (
        <div className="space-y-mdt-3 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
          <div className="space-y-mdt-1">
            <Text size="caption" weight="semibold" tone="muted" className="uppercase tracking-wide">
              Compatibility
            </Text>
            <Text size="bodySm" tone="muted">
              Review which targets support your current scopes and skills.
            </Text>
          </div>
          <CompatibilityMatrix features={compatibility.features} targets={compatibility.targets} />
          {compatibility.warnings.length > 0 ? (
            <div className="rounded-mdt-md border border-[color:var(--mdt-color-warning)]/30 bg-[color:var(--mdt-color-warning)]/10 p-mdt-3">
              <div className="mb-mdt-2 text-caption font-semibold text-[color:var(--mdt-color-warning)]">
                Compatibility warnings
              </div>
              <ul className="list-disc space-y-mdt-1 pl-mdt-5 text-caption text-[color:var(--mdt-color-warning)]">
                {compatibility.warnings.map((warning) => (
                  <li key={`${warning.targetId}-${warning.featureId}`}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-mdt-3 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
        <div className="flex flex-wrap items-center gap-mdt-2">
          <Button
            onClick={() => scheduleCompile(uam)}
            disabled={loading || uam.targets.length === 0}
            variant={exportReady ? 'secondary' : 'primary'}
            size="sm"
          >
            {loading ? 'Compiling…' : 'Compile'}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={loading || !result || result.files.length === 0}
            variant={exportReady ? 'primary' : 'secondary'}
            size="sm"
          >
            {exportLabel}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-mdt-3">
          <Text size="caption" tone="muted">
            {exportStatus}
          </Text>
          {error && <div className="text-caption text-[color:var(--mdt-color-danger)]">{error}</div>}
        </div>
      </div>

      {result && (
        <div className="space-y-mdt-3">
          {result.warnings.length > 0 && (
            <div className="rounded-mdt-md border border-[color:var(--mdt-color-warning)]/30 bg-[color:var(--mdt-color-warning)]/10 p-mdt-3">
              <div className="mb-mdt-2 text-caption font-semibold text-[color:var(--mdt-color-warning)]">Warnings</div>
              <ul className="list-disc space-y-mdt-1 pl-mdt-5 text-caption text-[color:var(--mdt-color-warning)]">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {result.info && result.info.length > 0 && (
            <div className="rounded-mdt-md border border-[color:var(--mdt-color-info)]/30 bg-[color:var(--mdt-color-info)]/10 p-mdt-3">
              <div className="mb-mdt-2 text-caption font-semibold text-[color:var(--mdt-color-info)]">Info</div>
              <ul className="list-disc space-y-mdt-1 pl-mdt-5 text-caption text-[color:var(--mdt-color-info)]">
                {result.info.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="mb-mdt-2 text-caption font-semibold uppercase tracking-wide text-mdt-muted">
              Manifest
            </div>
            <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <FileTree paths={manifestPaths} emptyLabel="No files generated." />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-mdt-2">
            <div className="text-caption font-semibold uppercase tracking-wide text-mdt-muted">
              File preview
            </div>
            <div className="flex items-center gap-mdt-2">
              <Button
                size="xs"
                variant={previewMode === 'raw' ? 'primary' : 'secondary'}
                onClick={() => setPreviewMode('raw')}
              >
                Raw
              </Button>
              <Button
                size="xs"
                variant={previewMode === 'diff' ? 'primary' : 'secondary'}
                onClick={() => setPreviewMode('diff')}
              >
                Diff
              </Button>
            </div>
          </div>

          {result.files.map((f) => (
            <div key={f.path} className="rounded-mdt-md border border-mdt-border bg-mdt-surface">
              <div className="flex items-center justify-between gap-mdt-2 border-b border-mdt-border px-mdt-3 py-mdt-2">
                <div className="font-mono text-caption text-mdt-text">{f.path}</div>
                <div className="flex items-center gap-mdt-2">
                  {copiedPath === f.path && <div className="text-[11px] text-mdt-muted">Copied</div>}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(f.content);
                        setCopiedPath(f.path);
                        setTimeout(() => setCopiedPath(null), 1000);
                        track('workbench_export_copy', {
                          path: f.path,
                          targetId: uam.targets.length === 1 ? uam.targets[0]?.targetId : undefined,
                          entrySource,
                        });
                        trackSkillExportAction({
                          action: 'copy',
                          path: f.path,
                          targetId: uam.targets.length === 1 ? uam.targets[0]?.targetId : undefined,
                          skillCount: uam.capabilities.length,
                          entrySource,
                        });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              {previewMode === 'diff' ? (
                <div className="p-mdt-3">
                  <DiffPreview
                    before={rawPreview}
                    after={f.content}
                    fileName={f.path}
                    emptyLabel="No changes between raw preview and export."
                  />
                </div>
              ) : (
                <pre className="p-mdt-3 font-mono text-caption whitespace-pre-wrap overflow-auto">{f.content}</pre>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-caption text-mdt-muted">
          Compiling… (debounced {COMPILE_DEBOUNCE_MS}ms)
        </div>
      )}
    </div>
  );
}
