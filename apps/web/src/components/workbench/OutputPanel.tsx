'use client';

import React, { useEffect, useState } from 'react';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { ExportPanel } from './ExportPanel';
import { PreviewPanel } from './PreviewPanel';
import { LintPanel } from './LintPanel';
import { DiffPanel } from './DiffPanel';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import type { WorkbenchEntrySource } from '@/components/workbench/workbenchEntry';

type OutputPanelProps = {
  entrySource?: WorkbenchEntrySource;
  initialTab?: 'preview' | 'export' | 'lint' | 'diff';
};

export function OutputPanel({ entrySource = 'direct', initialTab = 'export' }: OutputPanelProps) {
  const [tab, setTab] = useState<'preview' | 'export' | 'lint' | 'diff'>(initialTab);
  const selectedScopeId = useWorkbenchStore(s => s.selectedScopeId);
  const hasBlocks = useWorkbenchStore(s => s.uam.blocks.length > 0);
  const addBlock = useWorkbenchStore(s => s.addBlock);
  const selectBlock = useWorkbenchStore(s => s.selectBlock);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const handleAddBlock = () => {
    const id = addBlock({ kind: 'markdown', scopeId: selectedScopeId, body: '' });
    selectBlock(id);
  };

  return (
    <TabsRoot value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="flex h-full flex-col gap-mdt-3">
      <TabsList className="w-full">
        <TabsTrigger value="export">Export</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="lint">Lint</TabsTrigger>
        <TabsTrigger value="diff">Diff</TabsTrigger>
      </TabsList>

      {!hasBlocks && (
        <div className="rounded-mdt-lg border border-dashed border-mdt-border bg-mdt-surface-subtle p-mdt-4 text-body-sm text-mdt-muted">
          <div className="mb-mdt-2 text-body-sm font-semibold text-mdt-text">Nothing to export yet</div>
          <Text size="bodySm" tone="muted" className="mb-mdt-3">
            Add a block to preview and export agents.md.
          </Text>
          <Button size="xs" onClick={handleAddBlock}>
            Add a block
          </Button>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <TabsContent value="export" className="!mt-0 h-full border-none bg-transparent p-0 shadow-none">
          <ExportPanel entrySource={entrySource} />
        </TabsContent>
        <TabsContent value="preview" className="!mt-0 h-full border-none bg-transparent p-0 shadow-none">
          <PreviewPanel />
        </TabsContent>
        <TabsContent value="lint" className="!mt-0 h-full border-none bg-transparent p-0 shadow-none">
          <LintPanel />
        </TabsContent>
        <TabsContent value="diff" className="!mt-0 h-full border-none bg-transparent p-0 shadow-none">
          <DiffPanel />
        </TabsContent>
      </div>
    </TabsRoot>
  );
}
