import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SkillCard } from '@/components/skills/SkillCard';
import type { PublicSkillSummary } from '@/lib/skills/skillTypes';

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

describe('SkillCard', () => {
  const skill: PublicSkillSummary = {
    id: 'skill-1',
    slug: 'skill-1',
    title: 'Ship faster',
    description: 'Shorten delivery cycles with reusable automations.',
    tags: ['delivery', 'automation'],
    targets: ['agents-md', 'claude-code'],
    capabilityCount: 3,
    capabilities: [
      { id: 'release-notes', title: 'Release notes', description: 'Generate notes' },
      { id: 'changelog', title: 'Changelog', description: 'Keep changelogs updated' },
    ],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  it('renders metadata and actions', () => {
    render(<SkillCard skill={skill} />);

    expect(screen.getByText('Skill')).toBeInTheDocument();
    expect(screen.getByText('3 capabilities')).toBeInTheDocument();
    expect(screen.getByText('Ship faster')).toBeInTheDocument();
    expect(screen.getByText(/Shorten delivery cycles/i)).toBeInTheDocument();
    expect(screen.getByText('Codex CLI')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('#delivery')).toBeInTheDocument();
    expect(screen.getByText('#automation')).toBeInTheDocument();
    expect(screen.getByText('Release notes')).toBeInTheDocument();

    screen.getByRole('link', { name: 'View skill' });
    screen.getByRole('link', { name: 'Open in Workbench' });
  });

  it('tracks open workbench clicks', () => {
    render(<SkillCard skill={skill} />);

    fireEvent.click(screen.getByText('Open in Workbench'));

    expect(trackSkillOpenWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'skill-1',
        slug: 'skill-1',
        title: 'Ship faster',
        source: 'skills_list',
      })
    );
  });
});
