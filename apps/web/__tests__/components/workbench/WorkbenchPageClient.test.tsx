import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { WorkbenchPageClient } from '@/components/workbench/WorkbenchPageClient';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import type { UamV1 } from '@/lib/uam/uamTypes';

vi.mock('@/components/workbench/StructurePanel', () => ({
  StructurePanel: () => <div data-testid="structure-panel" />,
}));

vi.mock('@/components/workbench/EditorPanel', () => ({
  EditorPanel: () => <div data-testid="editor-panel" />,
}));

vi.mock('@/components/workbench/OutputPanel', () => ({
  OutputPanel: () => <div data-testid="output-panel" />,
}));

vi.mock('@/components/workbench/WorkbenchHeader', () => ({
  WorkbenchHeader: () => <div data-testid="workbench-header" />,
}));

vi.mock('@/components/workbench/WorkbenchOnboardingCard', () => ({
  WorkbenchOnboardingCard: () => <div data-testid="onboarding-card" />,
}));

const baseProps = {
  initialArtifactId: null,
  initialEntryHint: null,
  initialTemplateUam: null,
  initialScanContext: null,
  session: null,
};

const sampleUam: UamV1 = {
  schemaVersion: 1,
  meta: { title: 'Restored Draft', description: '' },
  scopes: [{ id: 'global', kind: 'global', name: 'Global' }],
  blocks: [{ id: 'block-1', scopeId: 'global', kind: 'markdown', body: 'Draft content' }],
  capabilities: [],
  targets: [],
};

function seedDraftStorage() {
  const payload = {
    state: {
      uam: sampleUam,
      selectedScopeId: 'global',
      visibility: 'PRIVATE',
      tags: [],
      lastSavedAt: Date.now(),
    },
    version: 3,
  };
  localStorage.setItem('workbench-storage', JSON.stringify(payload));
}

describe('WorkbenchPageClient', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true);
    });
    useWorkbenchStore.persist.clearStorage();
  });

  it('shows a draft restore prompt when local draft exists', async () => {
    seedDraftStorage();
    await act(async () => {
      await useWorkbenchStore.persist.rehydrate();
    });

    render(<WorkbenchPageClient {...baseProps} />);

    expect(await screen.findByText(/restore your last workbench draft/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard draft/i })).toBeInTheDocument();
  });

  it('discard clears storage and resets the draft', async () => {
    seedDraftStorage();
    await act(async () => {
      await useWorkbenchStore.persist.rehydrate();
    });

    render(<WorkbenchPageClient {...baseProps} />);

    fireEvent.click(await screen.findByRole('button', { name: /discard draft/i }));

    await waitFor(() => {
      expect(localStorage.getItem('workbench-storage')).toBeNull();
    });

    expect(useWorkbenchStore.getState().title).toBe('Untitled Agent');
    expect(screen.queryByTestId('workbench-draft-restore')).not.toBeInTheDocument();
  });
});
