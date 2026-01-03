'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { StructuredAssistPanel } from '@/components/workbench/StructuredAssistPanel';
import { cn } from '@/lib/cn';
import type { UamBlockKindV1 } from '@/lib/uam/uamTypes';

const KIND_OPTIONS: Array<{ kind: UamBlockKindV1; label: string }> = [
  { kind: 'markdown', label: 'Markdown' },
  { kind: 'checklist', label: 'Checklist' },
  { kind: 'commands', label: 'Commands' },
  { kind: 'dos-donts', label: "Dos/Don'ts" },
  { kind: 'files', label: 'Files' },
];

function blockPreview(block: { title?: string; body: string }) {
  const title = block.title?.trim();
  if (title && title.length > 0) return title;
  const body = block.body.trim();
  if (body.length === 0) return '(empty)';
  return body.split('\n')[0] ?? '(empty)';
}

export function BlocksPanel() {
  const selectedScopeId = useWorkbenchStore(s => s.selectedScopeId);
  const blocks = useWorkbenchStore(s => s.uam.blocks).filter(b => b.scopeId === selectedScopeId);
  const selectedBlockId = useWorkbenchStore(s => s.selectedBlockId);
  const addBlock = useWorkbenchStore(s => s.addBlock);
  const removeBlock = useWorkbenchStore(s => s.removeBlock);
  const moveBlock = useWorkbenchStore(s => s.moveBlock);
  const selectBlock = useWorkbenchStore(s => s.selectBlock);

  const [kind, setKind] = React.useState<UamBlockKindV1>('markdown');
  const [showStructuredAssist, setShowStructuredAssist] = React.useState(false);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    moveBlock(result.draggableId, result.destination.index);
  };

  const handleAdd = () => {
    const id = addBlock({ kind, scopeId: selectedScopeId, body: '' });
    selectBlock(id);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-mdt-2 flex items-center justify-between">
        <span className="text-caption font-semibold uppercase tracking-wider text-mdt-muted">Blocks</span>
        <div className="flex items-center gap-mdt-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setShowStructuredAssist((open) => !open)}
            aria-expanded={showStructuredAssist}
          >
            Structured assist
          </Button>
          <label className="sr-only" htmlFor="block-kind">
            Block kind
          </label>
          <Select
            id="block-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as UamBlockKindV1)}
            size="sm"
            className="w-32"
            aria-label="Block kind"
          >
            {KIND_OPTIONS.map(opt => (
              <option key={opt.kind} value={opt.kind}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Button size="xs" onClick={handleAdd}>
            + Add
          </Button>
        </div>
      </div>
      <Text size="bodySm" tone="muted" className="mb-mdt-3">
        Add instruction blocks for the selected scope.
      </Text>
      {showStructuredAssist && (
        <div className="mb-mdt-3">
          <StructuredAssistPanel onClose={() => setShowStructuredAssist(false)} />
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`blocks:${selectedScopeId}`}>
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex-1 min-h-0 overflow-y-auto space-y-mdt-2 pr-mdt-2"
            >
              {blocks.map((block, index) => (
                <Draggable key={block.id} draggableId={block.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={provided.draggableProps.style}
                      className={cn(
                        'group flex items-center gap-mdt-2 rounded-mdt-md border p-mdt-2 transition-colors duration-mdt-fast ease-mdt-standard motion-reduce:transition-none',
                        selectedBlockId === block.id
                          ? 'border-mdt-primary bg-mdt-primary/10'
                          : 'border-mdt-border bg-mdt-surface hover:border-mdt-primary-soft',
                        snapshot.isDragging ? 'shadow-lg opacity-80 z-50' : ''
                      )}
                      onClick={() => selectBlock(block.id)}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="cursor-grab px-mdt-1 text-mdt-muted hover:text-mdt-text"
                        aria-label="Drag handle"
                      >
                        ⋮⋮
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mb-mdt-1 flex items-center gap-mdt-2">
                          <span className="rounded-mdt-sm bg-mdt-surface-strong px-mdt-1 font-mono text-[10px] uppercase text-mdt-muted">
                            {block.kind}
                          </span>
                        </div>
                        <div className="truncate text-caption text-mdt-text font-mono">{blockPreview(block)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(block.id);
                        }}
                        className="p-mdt-1 text-mdt-muted opacity-0 group-hover:opacity-100 hover:text-mdt-danger"
                        aria-label="Remove block"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {blocks.length === 0 && (
                <div className="rounded-mdt-md border border-dashed border-mdt-border bg-mdt-surface-subtle p-mdt-3 text-body-sm text-mdt-muted">
                  <div className="mb-mdt-1 text-body-sm font-semibold text-mdt-text">No blocks yet</div>
                  <div className="mb-mdt-3">
                    Add a block to start writing instructions for this scope.
                  </div>
                  <Button size="xs" onClick={handleAdd}>
                    Add a block
                  </Button>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
