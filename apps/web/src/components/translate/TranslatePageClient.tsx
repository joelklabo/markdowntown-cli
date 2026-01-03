'use client';

import React, { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Stack } from '@/components/ui/Stack';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { TranslateInput } from '@/components/translate/TranslateInput';
import { TranslateOutput, type TranslateCompileResult } from '@/components/translate/TranslateOutput';
import { safeParseUamV1 } from '@/lib/uam/uamValidate';
import { createZip } from '@/lib/compile/zip';
import { createUamTargetV1, wrapMarkdownAsGlobal, type UamTargetV1, type UamV1 } from '@/lib/uam/uamTypes';
import { emitCityWordmarkEvent } from '@/components/wordmark/sim/bridge';
import {
  trackTranslateComplete,
  trackTranslateDownload,
  trackTranslateError,
  trackTranslateOpenWorkbench,
  trackTranslateStart,
} from '@/lib/analytics';

const COMPILE_TIMEOUT_MS = 30_000;

type TranslatePageClientProps = {
  initialInput: string;
  initialTargets: UamTargetV1[];
  initialError: string | null;
};

export function TranslatePageClient({ initialInput, initialTargets, initialError }: TranslatePageClientProps) {
  const [input, setInput] = useState(initialInput);
  const [targets, setTargets] = useState<UamTargetV1[]>(initialTargets);
  const [result, setResult] = useState<TranslateCompileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const detect = (text: string): { label: string; uam: UamV1 } => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { label: 'Empty', uam: wrapMarkdownAsGlobal('') };
    }

    try {
      const json = JSON.parse(trimmed);
      const parsed = safeParseUamV1(json);
      if (parsed.success) return { label: 'UAM v1 (JSON)', uam: parsed.data };
    } catch {
      // ignore
    }

    return { label: 'Markdown', uam: wrapMarkdownAsGlobal(text) };
  };

  const detected = detect(input);

  const WARN_CHARS = 50_000;
  const MAX_CHARS = 200_000;
  const isTooLarge = input.length > MAX_CHARS;
  const helperText =
    input.length > WARN_CHARS
      ? `Large input (${input.length.toLocaleString()} chars). Paste is limited to ${MAX_CHARS.toLocaleString()} chars.`
      : undefined;

  const toggleTarget = (t: string) => {
    setTargets((prev) =>
      prev.some((entry) => entry.targetId === t)
        ? prev.filter((entry) => entry.targetId !== t)
        : [...prev, createUamTargetV1(t)]
    );
  };

  const updateTarget = (targetId: string, patch: Partial<Omit<UamTargetV1, 'targetId'>>) => {
    setTargets((prev) =>
      prev.map((entry) => (entry.targetId === targetId ? { ...entry, ...patch } : entry))
    );
  };

  const handleCompile = async () => {
    const analyticsContext = {
      targetIds: targets.map((target) => target.targetId),
      targetCount: targets.length,
      inputChars: input.length,
      detectedLabel: detected.label,
    };
    let timeoutId: number | null = null;
    setLoading(true);
    setError(null);
    setResult(null);
    trackTranslateStart(analyticsContext);
    try {
      if (isTooLarge) {
        trackTranslateError(new Error('Input too large'), {
          ...analyticsContext,
          reason: 'input_too_large',
        });
        setError('Input is too large to compile.');
        emitCityWordmarkEvent({ type: 'alert', kind: 'ambulance' });
        return;
      }

      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), COMPILE_TIMEOUT_MS);

      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uam: detected.uam,
          targets,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error ?? 'Compilation failed';
        let safeMessage = message;
        if (message === 'Invalid payload') {
          safeMessage = 'Input is invalid. Please check the format and try again.';
        } else if (message === 'Payload too large' || message.includes('Payload too large')) {
          safeMessage = 'Input is too large. Please shorten it and try again.';
        } else if (message === 'No valid targets selected' || message === 'Unknown target selection') {
          safeMessage = 'Select at least one supported target to compile.';
        } else if (message === 'Rate limit exceeded') {
          safeMessage = 'You are doing that too often. Please wait a moment and try again.';
        }
        throw new Error(safeMessage);
      }

      const data = await res.json();
      setResult(data);
      trackTranslateComplete({
        ...analyticsContext,
        fileCount: Array.isArray(data?.files) ? data.files.length : 0,
        warningCount: Array.isArray(data?.warnings) ? data.warnings.length : 0,
        infoCount: Array.isArray(data?.info) ? data.info.length : 0,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        const timeoutError = new Error('Compilation timed out. Please try again.');
        trackTranslateError(timeoutError, { ...analyticsContext, reason: 'timeout' });
        setError(timeoutError.message);
        emitCityWordmarkEvent({ type: 'alert', kind: 'ambulance' });
        return;
      }
      const error = err instanceof Error ? err : new Error('Error compiling');
      trackTranslateError(error, { ...analyticsContext, reason: 'compile_failed' });
      setError(error.message);
      emitCityWordmarkEvent({ type: 'alert', kind: 'ambulance' });
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const downloadName =
        targets.length === 1
          ? `${targets[0].targetId}.zip`
          : targets.length > 1
            ? `translate-${targets.map((target) => target.targetId).join('-')}.zip`
            : 'translate-output.zip';
      const blob = await createZip(result.files);
      trackTranslateDownload({
        targetIds: targets.map((target) => target.targetId),
        targetCount: targets.length,
        fileCount: Array.isArray(result?.files) ? result.files.length : 0,
        byteSize: blob.size,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating zip');
      emitCityWordmarkEvent({ type: 'alert', kind: 'ambulance' });
    }
  };

  const handleOpenWorkbench = () => {
    if (!result) return;
    trackTranslateOpenWorkbench({
      targetIds: targets.map((target) => target.targetId),
      targetCount: targets.length,
      fileCount: Array.isArray(result?.files) ? result.files.length : 0,
    });
  };

  return (
    <Container size="xl" padding="lg" className="py-mdt-10 md:py-mdt-12">
      <Stack gap={8}>
        <Stack gap={3} className="max-w-2xl">
          <Text size="caption" tone="muted">Translate</Text>
          <Heading level="display" leading="tight">Translate instructions into Workbench-ready files</Heading>
          <Text tone="muted" leading="relaxed">
            Paste your instructions, choose targets, compile, and open in Workbench to refine and export.
          </Text>
        </Stack>

        <div className="flex flex-wrap items-center gap-mdt-4 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3">
          <Text size="caption" tone="muted" className="uppercase tracking-wide">
            Steps
          </Text>
          <Text size="bodySm" tone="muted">1. Select targets</Text>
          <Text size="bodySm" tone="muted">2. Paste input</Text>
          <Text size="bodySm" tone="muted">3. Compile + open Workbench</Text>
        </div>

        <div className="grid gap-mdt-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)] lg:items-start">
          <TranslateInput value={input} onChange={setInput} disabled={loading} helperText={helperText} />
          <TranslateOutput
            targets={targets}
            onToggleTarget={toggleTarget}
            onUpdateTarget={updateTarget}
            onCompile={handleCompile}
            onDownloadZip={handleDownload}
            onOpenWorkbench={handleOpenWorkbench}
            loading={loading}
            error={error}
            detectedLabel={detected.label}
            disabledCompile={isTooLarge || input.trim().length === 0}
            result={result}
          />
        </div>
      </Stack>
    </Container>
  );
}
