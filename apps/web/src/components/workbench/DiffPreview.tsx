import React from 'react';
import { DiffViewer } from '@/components/ui/DiffViewer';

type DiffPreviewProps = {
  before: string;
  after: string;
  fileName?: string;
  emptyLabel?: string;
  className?: string;
};

export function DiffPreview({ before, after, fileName, emptyLabel = 'No changes.', className }: DiffPreviewProps) {
  if (before === after) {
    return (
      <div className="rounded-mdt-lg border border-dashed border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3 text-body-sm text-mdt-muted">
        {emptyLabel}
      </div>
    );
  }

  return <DiffViewer before={before} after={after} fileName={fileName} className={className} />;
}
