'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';
import { Stack } from '@/components/ui/Stack';
import { Text } from '@/components/ui/Text';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import type { WorkbenchEntrySource } from '@/components/workbench/workbenchEntry';

type WorkbenchOnboardingCardProps = {
  entrySource: WorkbenchEntrySource;
  scanSummary?: {
    toolLabel: string;
    cwdLabel: string;
    fileCount: number;
    previewLabel: string;
  } | null;
};

export function WorkbenchOnboardingCard({ entrySource, scanSummary }: WorkbenchOnboardingCardProps) {
  const selectedScopeId = useWorkbenchStore(s => s.selectedScopeId);
  const addBlock = useWorkbenchStore(s => s.addBlock);
  const selectBlock = useWorkbenchStore(s => s.selectBlock);

  const stepsBySource: Record<WorkbenchEntrySource, string[]> = {
    scan: [
      'Review scan defaults and confirm targets.',
      'Add a scope or block to refine instructions.',
      'Export agents.md when ready.',
    ],
    library: [
      'Review the loaded instructions.',
      'Add or edit blocks to refine the output.',
      'Export agents.md when ready.',
    ],
    translate: [
      'Review the translated instructions.',
      'Add blocks or scopes to finalize details.',
      'Export agents.md when ready.',
    ],
    direct: [
      'Scan a folder to prefill Workbench.',
      'Add a scope or block to start building.',
      'Export agents.md when ready.',
    ],
  };

  const headingBySource: Record<WorkbenchEntrySource, string> = {
    scan: 'Build your agents.md',
    library: 'Refine this library item',
    translate: 'Finish your translation',
    direct: 'Build your agents.md',
  };

  const labelBySource: Record<WorkbenchEntrySource, string> = {
    scan: 'Scan defaults applied',
    library: 'Library item loaded',
    translate: 'Translation ready',
    direct: 'No scan context yet',
  };

  const introBySource: Record<WorkbenchEntrySource, string> = {
    scan: 'Local-only scan. Review defaults, then add blocks and export.',
    library: 'Start from this library item, then export when you are ready.',
    translate: 'Review the translation, then add any missing context before exporting.',
    direct: 'Scan a folder to see what loads, then build and export.',
  };

  const handleAddBlock = () => {
    const id = addBlock({ kind: 'markdown', scopeId: selectedScopeId, body: '' });
    selectBlock(id);
  };

  const steps = stepsBySource[entrySource];
  const heading = headingBySource[entrySource];
  const label = labelBySource[entrySource];
  const intro = introBySource[entrySource];
  const scanMeta =
    entrySource === 'scan' && scanSummary
      ? `${scanSummary.toolLabel} · cwd ${scanSummary.cwdLabel}`
      : null;

  return (
    <Card className="p-mdt-4 md:p-mdt-5">
      <Stack gap={3}>
        <div className="space-y-mdt-1">
          <Text
            size="caption"
            tone="muted"
            data-testid={entrySource === 'scan' ? 'workbench-scan-defaults-status' : undefined}
          >
            {label}
          </Text>
          <Heading level="h3" as="h2">{heading}</Heading>
          <Text tone="muted">{intro}</Text>
          {scanMeta ? (
            <Text size="caption" tone="muted">
              {scanMeta}
            </Text>
          ) : null}
        </div>

        <ol className="space-y-mdt-2 text-body-sm text-mdt-muted">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-mdt-2">
              <span className="font-semibold text-mdt-text">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-mdt-2">
          <Button size="sm" onClick={handleAddBlock}>
            Add a block
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <Link
              id="workbench-scan-cta"
              href={entrySource === 'library' ? '/library' : entrySource === 'translate' ? '/translate' : '/atlas/simulator'}
            >
              {entrySource === 'library'
                ? 'Back to Library'
                : entrySource === 'translate'
                  ? 'Back to Translate'
                  : entrySource === 'scan'
                    ? 'Back to Scan'
                    : 'Scan a folder'}
            </Link>
          </Button>
        </div>
      </Stack>
    </Card>
  );
}
