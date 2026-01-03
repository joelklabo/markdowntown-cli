import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SkillsPanel } from '@/components/workbench/SkillsPanel';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';

// Mock crypto.randomUUID for deterministic ids.
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: (() => {
      let i = 0;
      return () => `skill-${++i}`;
    })(),
  },
});

describe('SkillsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useWorkbenchStore.getState().resetDraft();
    });
  });

  it('adds, edits, and removes skills', () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole('button', { name: '+ Skill' }));
    expect(screen.getByText('New skill')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Sharper reviews' } });
    expect(useWorkbenchStore.getState().skills[0]?.title).toBe('Sharper reviews');

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Review safely' } });
    expect(useWorkbenchStore.getState().skills[0]?.description).toBe('Review safely');

    fireEvent.change(screen.getByLabelText('Params (JSON)'), { target: { value: '{"level":"strict"}' } });
    fireEvent.blur(screen.getByLabelText('Params (JSON)'));
    expect(useWorkbenchStore.getState().skills[0]?.params).toEqual({ level: 'strict' });

    fireEvent.click(screen.getByLabelText('Remove skill'));
    expect(useWorkbenchStore.getState().skills).toHaveLength(0);
  });
});
