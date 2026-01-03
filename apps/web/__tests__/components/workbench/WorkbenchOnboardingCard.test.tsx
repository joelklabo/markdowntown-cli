import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WorkbenchOnboardingCard } from '@/components/workbench/WorkbenchOnboardingCard';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import type { SimulatorToolId } from '@/lib/atlas/simulators/types';

const sampleScanContext = {
  tool: 'github-copilot' as SimulatorToolId,
  cwd: '/repo',
  paths: ['AGENTS.md'],
};

describe('WorkbenchOnboardingCard', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useWorkbenchStore.getState().resetDraft();
      useWorkbenchStore.setState({ scanContext: null });
    });
  });

  it('renders fallback guidance when no scan context is present', () => {
    render(<WorkbenchOnboardingCard entrySource="direct" />);

    expect(screen.getByText(/no scan context yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /scan a folder/i })).toBeInTheDocument();
    expect(screen.getByText(/scan a folder to prefill workbench/i)).toBeInTheDocument();
  });

  it('renders scan-aware guidance when scan context exists', () => {
    act(() => {
      useWorkbenchStore.setState({ scanContext: sampleScanContext });
    });

    render(<WorkbenchOnboardingCard entrySource="scan" />);

    expect(screen.getByText(/scan defaults applied/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to scan/i })).toBeInTheDocument();
    expect(screen.getByText(/local-only scan/i)).toBeInTheDocument();
  });

  it('renders correct back link and steps per entry source', () => {
    const cases = [
      { entrySource: 'library' as const, label: /library item loaded/i, href: '/library', link: /back to library/i },
      { entrySource: 'translate' as const, label: /translation ready/i, href: '/translate', link: /back to translate/i },
      { entrySource: 'scan' as const, label: /scan defaults applied/i, href: '/atlas/simulator', link: /back to scan/i },
      { entrySource: 'direct' as const, label: /no scan context yet/i, href: '/atlas/simulator', link: /scan a folder/i },
    ];

    cases.forEach(({ entrySource, label, href, link }) => {
      const { unmount } = render(<WorkbenchOnboardingCard entrySource={entrySource} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      const backLink = screen.getByRole('link', { name: link });
      expect(backLink).toHaveAttribute('href', href);
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      unmount();
    });
  });

  it('renders scan summary metadata when provided', () => {
    render(
      <WorkbenchOnboardingCard
        entrySource="scan"
        scanSummary={{
          toolLabel: 'GitHub Copilot',
          cwdLabel: '(repo root)',
          fileCount: 12,
          previewLabel: 'AGENTS.md',
        }}
      />
    );

    expect(screen.getByText(/GitHub Copilot · cwd \(repo root\)/i)).toBeInTheDocument();
  });

  it('adds a block and selects it', () => {
    render(<WorkbenchOnboardingCard entrySource="direct" />);

    const before = useWorkbenchStore.getState().blocks.length;
    fireEvent.click(screen.getByRole('button', { name: /add a block/i }));

    const after = useWorkbenchStore.getState().blocks.length;
    expect(after).toBe(before + 1);
    expect(useWorkbenchStore.getState().selectedBlockId).toBeTruthy();
  });
});
