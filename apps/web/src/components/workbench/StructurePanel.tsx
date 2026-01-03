'use client';

import React, { useState, useEffect } from 'react';
import { ScopesPanel } from './ScopesPanel';
import { BlocksPanel } from './BlocksPanel';
import { SkillsPanel } from './SkillsPanel';
import { Text } from '@/components/ui/Text';

export function StructurePanel() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return (
      <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface-subtle px-mdt-4 py-mdt-3 text-body-sm text-mdt-muted">
        Loading structure...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-mdt-3 overflow-y-auto pr-mdt-2">
      <div className="rounded-mdt-lg border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2">
        <Text size="caption" tone="muted" leading="relaxed">
          Scopes tell the model where instructions apply. Blocks are the actual instructions inside each scope. Skills capture reusable capabilities.
        </Text>
      </div>
      <ScopesPanel />
      <div className="h-px bg-mdt-border" />
      <BlocksPanel />
      <div className="h-px bg-mdt-border" />
      <SkillsPanel />
    </div>
  );
}
