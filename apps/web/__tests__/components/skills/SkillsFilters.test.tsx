import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SkillsFilters } from '@/components/skills/SkillsFilters';

vi.mock('next/link', () => {
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode };
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: LinkProps) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  };
});

describe('SkillsFilters', () => {
  it('renders filter controls with selected values', () => {
    render(
      <SkillsFilters
        q="lint"
        tags={["frontend"]}
        targets={["agents-md"]}
        sort="views"
        topTags={[{ tag: 'frontend', count: 12 }, { tag: 'tooling', count: 5 }]}
        availableTargets={["agents-md", "claude-code"]}
      />
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search skills or capabilities…')).toHaveValue('lint');
    expect(screen.getByText('Most viewed')).toBeInTheDocument();
    expect(screen.getByText('Codex CLI')).toBeInTheDocument();
    expect(screen.getByText('#frontend')).toBeInTheDocument();
  });
});
