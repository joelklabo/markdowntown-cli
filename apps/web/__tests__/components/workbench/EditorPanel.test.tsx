import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorPanel } from '@/components/workbench/EditorPanel';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { createEmptyUamV1, GLOBAL_SCOPE_ID } from '@/lib/uam/uamTypes';

describe('EditorPanel', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      uam: {
        ...createEmptyUamV1({ title: 'Test' }),
        blocks: [{ id: 'b1', scopeId: GLOBAL_SCOPE_ID, kind: 'markdown', body: 'Initial' }],
      },
      selectedBlockId: 'b1',
    });
  });

  it('renders editor with block body', () => {
    render(<EditorPanel />);
    expect(screen.getByDisplayValue('Initial')).toBeInTheDocument();
  });

  it('updates body', () => {
    render(<EditorPanel />);
    const textarea = screen.getByDisplayValue('Initial');
    fireEvent.change(textarea, { target: { value: 'Updated' } });
    
    expect(useWorkbenchStore.getState().uam.blocks[0]?.body).toBe('Updated');
  });

  it('updates title', () => {
    render(<EditorPanel />);
    const titleInput = screen.getByLabelText('Block title');
    fireEvent.change(titleInput, { target: { value: 'My Title' } });
    expect(useWorkbenchStore.getState().uam.blocks[0]?.title).toBe('My Title');
  });

  it('switches kind via slash command', () => {
    render(<EditorPanel />);
    const textarea = screen.getByDisplayValue('Initial');
    
    fireEvent.change(textarea, { target: { value: '/checklist ' } });
    
    const block = useWorkbenchStore.getState().uam.blocks[0];
    expect(block?.kind).toBe('checklist');
    expect(block?.body).toContain('- [ ]');
  });
});
