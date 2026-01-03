import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StructuredAssistPanel } from '@/components/workbench/StructuredAssistPanel';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { createEmptyUamV1, GLOBAL_SCOPE_ID } from '@/lib/uam/uamTypes';

describe('StructuredAssistPanel', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      uam: createEmptyUamV1({ title: 'Test' }),
      selectedScopeId: GLOBAL_SCOPE_ID,
      selectedBlockId: null,
    });
  });

  it('inserts a new scoped block', () => {
    render(<StructuredAssistPanel />);

    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'dir' } });
    fireEvent.change(screen.getByLabelText('Directory path'), { target: { value: 'src/components' } });
    fireEvent.change(screen.getByLabelText('Block kind'), { target: { value: 'commands' } });
    fireEvent.change(screen.getByLabelText('Block title (optional)'), { target: { value: 'CLI setup' } });

    fireEvent.click(screen.getByRole('button', { name: /insert block/i }));

    const state = useWorkbenchStore.getState();
    const scope = state.uam.scopes.find((entry) => entry.kind === 'dir' && entry.dir === 'src/components');
    expect(scope).toBeDefined();

    const block = state.uam.blocks.find((entry) => entry.title === 'CLI setup');
    expect(block?.kind).toBe('commands');
    expect(block?.scopeId).toBe(scope?.id);
    expect(block?.body).toContain('```bash');
  });
});
