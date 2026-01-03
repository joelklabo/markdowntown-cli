import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { StructurePanel } from '@/components/workbench/StructurePanel';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: (() => {
      let i = 0;
      return () => `test-uuid-${++i}`;
    })(),
  },
});

describe('StructurePanel', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useWorkbenchStore.getState().resetDraft();
    });
  });

  // Mock requestAnimationFrame for the DnD hydration guard
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  it('adds a glob scope with inline validation', async () => {
    render(<StructurePanel />);

    await waitFor(() => expect(screen.getByText('Scopes')).toBeInTheDocument());
    expect(
      screen.getByText('Scopes tell the model where instructions apply. Blocks are the actual instructions inside each scope. Skills capture reusable capabilities.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add scope' }));
    fireEvent.change(screen.getByLabelText('Scope glob pattern'), { target: { value: '[' } });

    expect(screen.getByText('Invalid glob pattern syntax')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Scope glob pattern'), { target: { value: 'src/**/*.ts' } });
    expect(screen.queryByText('Invalid glob pattern syntax')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('src/**/*.ts')).toBeInTheDocument();
  });
  
  it('adds and removes a block within the selected scope', async () => {
    render(<StructurePanel />);

    await waitFor(() => expect(screen.getByText('Blocks')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Block kind'), { target: { value: 'checklist' } });
    fireEvent.click(screen.getByText('+ Add'));

    const { uam } = useWorkbenchStore.getState();
    expect(uam.blocks).toHaveLength(1);
    expect(uam.blocks[0]?.kind).toBe('checklist');
    expect(uam.blocks[0]?.scopeId).toBe('global');

    expect(screen.getByText('(empty)')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove block'));
    expect(useWorkbenchStore.getState().uam.blocks).toHaveLength(0);
    expect(screen.getByText('No blocks yet')).toBeInTheDocument();
  });

  it('shows blocks for the selected scope', async () => {
    act(() => {
      const store = useWorkbenchStore.getState();
      const scopeId = store.addScope({ kind: 'glob', patterns: ['src/**/*.ts'] });
      store.addBlock({ id: 'g1', scopeId: 'global', kind: 'markdown', body: 'global-body' });
      store.addBlock({ id: 's1', scopeId, kind: 'markdown', body: 'scoped-body' });
      store.selectScope('global');
    });

    render(<StructurePanel />);
    await waitFor(() => expect(screen.getByText('Blocks')).toBeInTheDocument());

    expect(screen.getByText('global-body')).toBeInTheDocument();
    expect(screen.queryByText('scoped-body')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('src/**/*.ts'));
    await waitFor(() => expect(screen.getByText('scoped-body')).toBeInTheDocument());
    expect(screen.queryByText('global-body')).not.toBeInTheDocument();
  });
});
