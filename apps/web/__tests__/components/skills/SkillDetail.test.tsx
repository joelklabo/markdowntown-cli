import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SkillDetail } from '@/components/skills/SkillDetail';
import type { PublicSkillDetail } from '@/lib/skills/skillTypes';
import { createEmptyUamV1 } from '@/lib/uam/uamTypes';

vi.mock('next/link', () => {
  type LinkProps = React.HTMLAttributes<HTMLSpanElement> & { href: string; children: React.ReactNode };
  return {
    __esModule: true,
    default: ({ href, children, onClick, ...rest }: LinkProps) => (
      <span
        role="link"
        tabIndex={0}
        data-href={href}
        {...rest}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
      >
        {children}
      </span>
    ),
  };
});

const trackSkillOpenWorkbench = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics', () => ({
  trackSkillOpenWorkbench,
}));

describe('SkillDetail', () => {
  const baseSkill: PublicSkillDetail = {
    id: 'skill-2',
    slug: 'skill-2',
    title: 'Refactor safely',
    description: 'Step-by-step refactor guidance.',
    tags: ['refactor'],
    targets: ['agents-md'],
    capabilityCount: 1,
    capabilities: [{ id: 'refactor', title: 'Refactor', description: 'Safe refactors' }],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    version: '1.0.0',
    content: {
      ...createEmptyUamV1({ title: 'Refactor safely' }),
      capabilities: [{ id: 'refactor', title: 'Refactor', description: 'Safe refactors' }],
    },
  };

  it('renders capability details and CTA', () => {
    render(<SkillDetail skill={baseSkill} />);

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Refactor')).toBeInTheDocument();
    expect(screen.getByText('refactor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Workbench' })).toBeInTheDocument();
  });

  it('shows empty state and tracks add-to-workbench CTA', () => {
    const emptySkill = {
      ...baseSkill,
      capabilityCount: 0,
      capabilities: [],
      content: { ...baseSkill.content, capabilities: [] },
    };

    render(<SkillDetail skill={emptySkill} />);

    expect(screen.getByText('No capabilities defined yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add capabilities'));

    expect(trackSkillOpenWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'skill-2',
        slug: 'skill-2',
        title: 'Refactor safely',
        source: 'skills_detail_empty_state',
      })
    );
  });
});
