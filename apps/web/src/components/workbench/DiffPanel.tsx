'use client';

import React from 'react';
import { DiffPreview } from '@/components/workbench/DiffPreview';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';

type DiffPanelProps = {
  before?: string;
  after?: string;
  fileName?: string;
  summary?: string;
  emptyLabel?: string;
};

export function DiffPanel({
  before,
  after,
  fileName = 'uam.json',
  summary = 'Comparing current draft to baseline.',
  emptyLabel = 'No changes.',
}: DiffPanelProps) {
  const uam = useWorkbenchStore((s) => s.uam);
  const baselineUam = useWorkbenchStore((s) => s.baselineUam);

  if (!baselineUam && !before) {
    return (
      <div className="rounded-mdt-lg border border-dashed border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3 text-body-sm text-mdt-muted">
        No baseline to compare yet.
      </div>
    );
  }

  const resolvedBefore = before ?? JSON.stringify(baselineUam, null, 2);
  const resolvedAfter = after ?? JSON.stringify(uam, null, 2);

  return (
    <div className="h-full overflow-auto space-y-mdt-3 p-mdt-4">
      <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-caption text-mdt-muted">
        {summary}
      </div>
      <DiffPreview before={resolvedBefore} after={resolvedAfter} fileName={fileName} emptyLabel={emptyLabel} />
    </div>
  );
}
