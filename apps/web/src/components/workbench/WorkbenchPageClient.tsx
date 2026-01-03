'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabsList, TabsRoot, TabsTrigger } from '@/components/ui/Tabs';
import { StructurePanel } from '@/components/workbench/StructurePanel';
import { EditorPanel } from '@/components/workbench/EditorPanel';
import { OutputPanel } from '@/components/workbench/OutputPanel';
import { WorkbenchHeader } from '@/components/workbench/WorkbenchHeader';
import { WorkbenchOnboardingCard } from '@/components/workbench/WorkbenchOnboardingCard';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { usePrefersReducedMotion } from '@/components/motion/usePrefersReducedMotion';
import type { Session } from 'next-auth';
import { readStoredScanContext, readStoredWorkbenchDraftMeta, useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { getTimeSinceSessionStartMs, track } from '@/lib/analytics';
import type { SimulatorToolId } from '@/lib/atlas/simulators/types';
import type { UamV1 } from '@/lib/uam/uamTypes';
import type { WorkbenchEntrySource } from '@/components/workbench/workbenchEntry';

type ScanContext = {
  tool: SimulatorToolId;
  cwd: string;
  paths: string[];
};

type WorkbenchPageClientProps = {
  initialArtifactId: string | null;
  initialEntryHint: 'translate' | null;
  initialTemplateUam: UamV1 | null;
  initialScanContext: ScanContext | null;
  session: Session | null;
};

const TOOL_LABELS: Record<SimulatorToolId, string> = {
  'github-copilot': 'GitHub Copilot',
  'copilot-cli': 'Copilot CLI',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'codex-cli': 'Codex CLI',
  cursor: 'Cursor',
};

export function WorkbenchPageClient({
  initialArtifactId,
  initialEntryHint,
  initialTemplateUam,
  initialScanContext,
  session,
}: WorkbenchPageClientProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const storedScanContext = useMemo(() => readStoredScanContext(), []);

  const [mobileTab, setMobileTab] = useState<'structure' | 'editor' | 'output'>(() => {
    if (initialArtifactId || initialTemplateUam) return 'editor';
    if (initialScanContext || storedScanContext) return 'output';
    if (initialEntryHint === 'translate') return 'output';
    return 'editor';
  });
  const [mounted, setMounted] = useState(false);
  const [artifactNotice, setArtifactNotice] = useState<{
    status: 'idle' | 'loading' | 'loaded' | 'error';
    title?: string;
    message?: string;
  }>({ status: 'idle' });
  const [showArtifactNotice, setShowArtifactNotice] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<{ lastSavedAt: number | null } | null>(null);
  const appliedScanRef = useRef(false);
  const focusAppliedRef = useRef(false);
  const openWorkbenchTrackedRef = useRef(false);
  const draftPromptedRef = useRef(false);

  const loadArtifact = useWorkbenchStore(s => s.loadArtifact);
  const initializeFromTemplate = useWorkbenchStore(s => s.initializeFromTemplate);
  const applyScanContext = useWorkbenchStore(s => s.applyScanContext);
  const clearScanContext = useWorkbenchStore(s => s.clearScanContext);
  const scanContext = useWorkbenchStore(s => s.scanContext);
  const hasBlocks = useWorkbenchStore(s => s.uam.blocks.length > 0);
  const saveConflict = useWorkbenchStore(s => s.saveConflict);
  const setSaveConflict = useWorkbenchStore(s => s.setSaveConflict);
  const setSecretScan = useWorkbenchStore(s => s.setSecretScan);
  const clearSaveConflict = useWorkbenchStore(s => s.clearSaveConflict);
  const reloadArtifact = useWorkbenchStore(s => s.reloadArtifact);
  const discardDraft = useWorkbenchStore(s => s.discardDraft);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugConflict') === '1') {
      setSaveConflict({ status: 'conflict' });
    }
    if (params.get('debugSecretScan') === '1') {
      setSecretScan({
        status: 'blocked',
        matches: [{ label: 'GitHub token', redacted: 'ghp_…0123' }],
      });
    }
  }, [setSaveConflict, setSecretScan]);

  useEffect(() => {
    if (!mounted) return;

    if (initialArtifactId && initialArtifactId.length > 0) {
      let cancelled = false;
      void loadArtifact(initialArtifactId).then((result) => {
        if (cancelled) return;
        if (result.status === 'loaded') {
          setArtifactNotice({ status: 'loaded', title: result.title });
        } else {
          setArtifactNotice({ status: 'error', message: result.message });
        }
        setShowArtifactNotice(true);
      });
      return () => {
        cancelled = true;
      };
    }

    if (initialTemplateUam) {
      initializeFromTemplate(initialTemplateUam);
    }
  }, [initializeFromTemplate, initialArtifactId, initialTemplateUam, loadArtifact, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (appliedScanRef.current) return;
    if (initialArtifactId || initialTemplateUam) return;
    if (scanContext) return;
    const context = initialScanContext ?? readStoredScanContext();
    if (!context) return;
    applyScanContext(context);
    appliedScanRef.current = true;
  }, [applyScanContext, initialArtifactId, initialScanContext, initialTemplateUam, mounted, scanContext]);

  useEffect(() => {
    if (!mounted) return;
    if (draftPromptedRef.current) return;
    if (initialArtifactId || initialTemplateUam) return;
    const storedDraft = readStoredWorkbenchDraftMeta();
    if (!storedDraft || !storedDraft.hasDraft || storedDraft.hasArtifactId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftPrompt({ lastSavedAt: storedDraft.lastSavedAt });
    draftPromptedRef.current = true;
  }, [initialArtifactId, initialTemplateUam, mounted]);

  const scanSummary = useMemo(() => {
    if (!scanContext) return null;
    const toolLabel = TOOL_LABELS[scanContext.tool] ?? scanContext.tool;
    const cwdLabel = scanContext.cwd ? scanContext.cwd : '(repo root)';
    const fileCount = scanContext.paths.length;
    const preview = scanContext.paths.slice(0, 3);
    const previewLabel =
      preview.length > 0
        ? `${preview.join(', ')}${fileCount > preview.length ? ` +${fileCount - preview.length} more` : ''}`
        : 'No instruction files detected.';

    return {
      toolLabel,
      cwdLabel,
      fileCount,
      previewLabel,
    };
  }, [scanContext]);

  const entrySource = useMemo<WorkbenchEntrySource>(() => {
    if (initialArtifactId || initialTemplateUam) return 'library';
    if (scanContext || initialScanContext || storedScanContext) return 'scan';
    if (initialEntryHint === 'translate') return 'translate';
    return 'direct';
  }, [initialArtifactId, initialEntryHint, initialScanContext, initialTemplateUam, scanContext, storedScanContext]);

  useEffect(() => {
    if (!mounted) return;
    if (openWorkbenchTrackedRef.current) return;
    openWorkbenchTrackedRef.current = true;
    const timeToOpenMs =
      typeof getTimeSinceSessionStartMs === 'function' ? getTimeSinceSessionStartMs() : undefined;
    const timing = timeToOpenMs === undefined ? {} : { time_to_open_workbench_ms: timeToOpenMs };
    track('open_workbench', {
      entrySource,
      ...timing,
    });
  }, [entrySource, mounted]);

  const preferredMobileTab = useMemo<'structure' | 'editor' | 'output'>(() => {
    if (entrySource === 'scan' || entrySource === 'translate') return 'output';
    return 'editor';
  }, [entrySource]);

  const focusById = useCallback((id: string) => {
    if (typeof document === 'undefined') return false;
    const element = document.getElementById(id);
    if (!element) return false;
    if ('focus' in element) {
      try {
        (element as HTMLElement).focus({ preventScroll: true });
      } catch {
        (element as HTMLElement).focus();
      }
    }
    if ('scrollIntoView' in element) {
      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }
    return true;
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!mounted) return;
    if (focusAppliedRef.current) return;
    if (mobileTab !== preferredMobileTab) return;

    const targetIds =
      entrySource === 'scan' || entrySource === 'translate'
        ? ['workbench-export-panel']
        : entrySource === 'library'
          ? ['workbench-block-title', 'workbench-editor-panel', 'workbench-export-panel']
          : ['workbench-scan-cta', 'workbench-block-title', 'workbench-editor-panel'];

    const timer = window.setTimeout(() => {
      for (const id of targetIds) {
        if (focusById(id)) {
          focusAppliedRef.current = true;
          return;
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [entrySource, focusById, mobileTab, mounted, preferredMobileTab]);

  const handleClearScan = () => {
    clearScanContext();
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('scanTool');
      url.searchParams.delete('scanCwd');
      url.searchParams.delete('scanPaths');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  };

  const handleRestoreDraft = () => {
    useWorkbenchStore.persist.rehydrate();
    setDraftPrompt(null);
  };

  const handleDiscardDraft = () => {
    discardDraft();
    setDraftPrompt(null);
  };

  const draftSavedLabel = useMemo(() => {
    if (!draftPrompt?.lastSavedAt) return 'Saved on this device.';
    return `Last saved ${new Date(draftPrompt.lastSavedAt).toLocaleString()}`;
  }, [draftPrompt]);

  if (!mounted) return null;

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-0 flex-col bg-mdt-bg">
      <WorkbenchHeader session={session} />

      {saveConflict.status === 'conflict' ? (
        <div className="border-b border-mdt-border bg-mdt-surface px-mdt-4 py-mdt-3">
          <div className="flex flex-wrap items-start justify-between gap-mdt-3">
            <div className="space-y-mdt-1">
              <Text size="caption" tone="muted">
                Save conflict detected
              </Text>
              <Text weight="semibold">This artifact was updated elsewhere.</Text>
              <Text size="bodySm" tone="muted">
                Reload the latest version or keep editing and reconcile manually.
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-mdt-2">
              <Button size="sm" variant="secondary" onClick={() => void reloadArtifact()}>
                Reload latest
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSaveConflict}>
                Keep editing
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {draftPrompt ? (
        <div
          data-testid="workbench-draft-restore"
          className="border-b border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-mdt-3">
            <div className="space-y-mdt-1">
              <Text size="caption" tone="muted">
                Draft found
              </Text>
              <Text weight="semibold">Restore your last Workbench draft?</Text>
              <Text size="bodySm" tone="muted">
                {draftSavedLabel}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-mdt-2">
              <Button size="sm" onClick={handleRestoreDraft}>
                Restore draft
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDiscardDraft}>
                Discard draft
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showArtifactNotice && (artifactNotice.status === 'loaded' || artifactNotice.status === 'error') ? (
        <div className="border-b border-mdt-border bg-mdt-surface px-mdt-4 py-mdt-3">
          <div className="flex flex-wrap items-start justify-between gap-mdt-3">
            <div className="space-y-mdt-1">
              <Text size="caption" tone="muted">
                {artifactNotice.status === 'loaded' ? 'Library item loaded' : 'Library item unavailable'}
              </Text>
              <Text weight="semibold">
                {artifactNotice.status === 'loaded'
                  ? artifactNotice.title ?? 'Loaded into Workbench'
                  : artifactNotice.message ?? 'Unable to load that library item.'}
              </Text>
              <Text size="bodySm" tone="muted">
                {artifactNotice.status === 'loaded'
                  ? 'You can edit this item in Workbench and export when you are ready.'
                  : 'Try opening a different item from the Library or check your access.'}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-mdt-2">
              <Button size="sm" variant="secondary" onClick={() => setShowArtifactNotice(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {scanSummary ? (
        <div className="border-b border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3">
          <div className="flex flex-wrap items-start justify-between gap-mdt-3">
            <div className="space-y-mdt-1">
              <Text size="caption" tone="muted">
                Scan defaults applied
              </Text>
              <Text weight="semibold">
                {scanSummary.toolLabel} · cwd {scanSummary.cwdLabel}
              </Text>
              <Text size="bodySm" tone="muted">
                {scanSummary.previewLabel}
              </Text>
              <Text size="caption" tone="muted">
                Local-only scan. Nothing leaves your device.
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-mdt-2">
              <Button size="sm" variant="secondary" onClick={handleClearScan}>
                Clear scan defaults
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-b border-mdt-border bg-mdt-surface px-mdt-4 py-mdt-3 md:hidden">
        <TabsRoot
          value={mobileTab}
          onValueChange={(value) => setMobileTab(value as typeof mobileTab)}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="structure" className="flex-1">Structure</TabsTrigger>
            <TabsTrigger value="editor" className="flex-1">Editor</TabsTrigger>
            <TabsTrigger value="output" className="flex-1">Output</TabsTrigger>
          </TabsList>
        </TabsRoot>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div
          className={`h-full border-r border-mdt-border bg-mdt-surface-subtle ${
            mobileTab === 'structure' ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="h-full overflow-hidden p-mdt-4 md:p-mdt-5">
            <StructurePanel />
          </div>
        </div>

        <div className={`relative h-full bg-mdt-surface ${mobileTab === 'editor' ? 'block' : 'hidden md:block'}`}>
          <div className="h-full overflow-hidden p-mdt-4 md:p-mdt-5">
            <div className="flex h-full flex-col gap-mdt-4">
              {!hasBlocks && <WorkbenchOnboardingCard entrySource={entrySource} scanSummary={scanSummary} />}
              <div className="flex-1 min-h-0">
                <div id="workbench-editor-panel" tabIndex={-1} className="h-full">
                  <EditorPanel />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`h-full border-l border-mdt-border bg-mdt-surface-subtle ${
            mobileTab === 'output' ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="flex h-full flex-col overflow-hidden p-mdt-4 md:p-mdt-5">
            <OutputPanel entrySource={entrySource} initialTab="export" />
          </div>
        </div>
      </div>
    </div>
  );
}
