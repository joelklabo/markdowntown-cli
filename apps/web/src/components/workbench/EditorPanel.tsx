'use client';

import React from 'react';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CodeEditor } from '@/components/ui/CodeEditor';
import { Text } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import type { UamBlockKindV1 } from '@/lib/uam/uamTypes';

export function EditorPanel() {
  const selectedBlockId = useWorkbenchStore(s => s.selectedBlockId);
  const blocks = useWorkbenchStore(s => s.uam.blocks);
  const selectedScopeId = useWorkbenchStore(s => s.selectedScopeId);
  const addBlock = useWorkbenchStore(s => s.addBlock);
  const updateBlock = useWorkbenchStore(s => s.updateBlock);
  const updateBlockBody = useWorkbenchStore(s => s.updateBlockBody);
  const updateBlockTitle = useWorkbenchStore(s => s.updateBlockTitle);
  const selectBlock = useWorkbenchStore(s => s.selectBlock);

  const block = blocks.find(b => b.id === selectedBlockId);
  const hasBlocks = blocks.length > 0;

  if (!block) {
    const handleAddBlock = () => {
      const id = addBlock({ kind: 'markdown', scopeId: selectedScopeId, body: '' });
      selectBlock(id);
    };

    const firstBlockId = blocks[0]?.id;
    const handleSelectFirst = () => {
      if (firstBlockId) selectBlock(firstBlockId);
    };

    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md rounded-mdt-lg border border-dashed border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-4 text-center text-body-sm text-mdt-muted">
          <div className="mb-mdt-2 text-body-sm font-semibold text-mdt-text">
            {hasBlocks ? 'Select a block to edit' : 'Start with a block'}
          </div>
          <Text size="bodySm" tone="muted" className="mb-mdt-3" leading="relaxed">
            {hasBlocks
              ? 'Choose a block from the list to edit it.'
              : 'Add a block to write your first instructions.'}
          </Text>
          {hasBlocks ? (
            <Button
              size="xs"
              onClick={handleSelectFirst}
              disabled={!firstBlockId}
              data-testid="workbench-add-block"
            >
              Open first block
            </Button>
          ) : (
            <Button size="xs" onClick={handleAddBlock} data-testid="workbench-add-block">
              Add a block
            </Button>
          )}
        </div>
      </div>
    );
  }

  const helpersByKind: Record<UamBlockKindV1, { placeholder: string; template?: string }> = {
    markdown: { placeholder: 'Write Markdown instructions…' },
    checklist: {
      placeholder: 'Checklist items (Markdown)…',
      template: '- [ ] Add item\n- [ ] Add item\n',
    },
    commands: {
      placeholder: 'Commands to run (Markdown)…',
      template: '```bash\npnpm test\n```\n',
    },
    'dos-donts': {
      placeholder: "Dos and don'ts (Markdown)…",
      template: '## Do\n- \n\n## Don’t\n- \n',
    },
    files: {
      placeholder: 'Files to read/write (Markdown)…',
      template: '- `src/...`\n- `__tests__/...`\n',
    },
  };

  const slashCommands: Array<{ cmd: string; kind: UamBlockKindV1 }> = [
    { cmd: '/checklist', kind: 'checklist' },
    { cmd: '/commands', kind: 'commands' },
    { cmd: '/files', kind: 'files' },
  ];

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;

    if (val.startsWith('/')) {
      const match = slashCommands.find(s => val === s.cmd || val === `${s.cmd} `);
      if (match) {
        const template = helpersByKind[match.kind].template ?? '';
        updateBlock(block.id, { kind: match.kind });
        updateBlockBody(block.id, template);
        return;
      }
    }

    updateBlockBody(block.id, val);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-mdt-4 flex flex-col gap-mdt-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="workbench-block-title" className="sr-only">
          Block title
        </label>
        <Input
          id="workbench-block-title"
          name="blockTitle"
          value={block.title ?? ''}
          onChange={(e) => updateBlockTitle(block.id, e.target.value || undefined)}
          placeholder="Block title (optional)"
          size="sm"
          className="w-full sm:max-w-lg"
        />
        <Badge tone="neutral" className="w-fit font-mono uppercase tracking-wide">
          {block.kind}
        </Badge>
      </div>

      <label htmlFor="workbench-block-body" className="sr-only">
        Block content
      </label>
      <CodeEditor
        id="workbench-block-body"
        name="blockBody"
        value={block.body}
        onChange={handleBodyChange}
        size="sm"
        className="flex-1 resize-none"
        placeholder={helpersByKind[block.kind].placeholder}
        autoFocus
      />

      <div className="mt-mdt-3 rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-mdt-2 text-caption text-mdt-muted">
        Tip: Type <code>/checklist</code>, <code>/commands</code>, <code>/files</code> to switch kind.
      </div>
    </div>
  );
}
