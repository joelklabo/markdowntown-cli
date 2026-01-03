import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LintPanel } from '@/components/workbench/LintPanel';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';

describe('LintPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useWorkbenchStore.getState().resetDraft();
    });
  });

  it('renders lint warnings grouped by scope with fix stubs', () => {
    act(() => {
      const store = useWorkbenchStore.getState();
      store.setUam({
        ...store.uam,
        scopes: [
          { id: 'global', kind: 'global' },
          { id: 'src', kind: 'dir', dir: 'src' },
        ],
        targets: [{ targetId: 'github-copilot', adapterVersion: '1', options: {} }],
        blocks: [{ id: 'b1', scopeId: 'src', kind: 'commands', body: '```bash\nrm -rf .\n```' }],
      });
    });

    render(<LintPanel />);

    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();

    expect(screen.getByText(/No setup command detected/i)).toBeInTheDocument();
    expect(screen.getByText(/No test command detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Dangerous command pattern detected/i)).toBeInTheDocument();
    expect(screen.getByText(/does not support dir scope/i)).toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: /stub/i }).length).toBeGreaterThan(0);
  });
});

