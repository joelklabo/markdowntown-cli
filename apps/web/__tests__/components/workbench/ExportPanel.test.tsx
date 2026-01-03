import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExportPanel } from '@/components/workbench/ExportPanel';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { createUamTargetV1 } from '@/lib/uam/uamTypes';
import { createZip } from '@/lib/compile/zip';
import { track } from '@/lib/analytics';

vi.mock('@/lib/compile/zip', () => ({
  createZip: vi.fn().mockResolvedValue(new Blob([])),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  trackSkillExportAction: vi.fn(),
  trackSkillExportConfig: vi.fn(),
  getTimeSinceSessionStartMs: vi.fn(() => 1200),
}));

global.URL.createObjectURL = vi.fn(() => 'blob:url');
global.URL.revokeObjectURL = vi.fn();

describe('ExportPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useWorkbenchStore.getState().resetDraft();
      useWorkbenchStore.setState({ compilationResult: null });
      const store = useWorkbenchStore.getState();
      store.setUam({ ...store.uam, targets: [createUamTargetV1('agents-md')] });
    });
    vi.clearAllMocks();
    global.fetch = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('compiles and downloads a zip', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [{ path: 'AGENTS.md', content: '# Hello' }],
        warnings: [],
        info: [],
      }),
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ExportPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Compile/i }));

    await waitFor(() => {
      expect(screen.getByText('Manifest')).toBeInTheDocument();
      expect(screen.getByText('# Hello')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Raw' })).toBeInTheDocument();
    const diffButton = screen.getByRole('button', { name: 'Diff' });
    fireEvent.click(diffButton);

    await waitFor(() => {
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });

    const download = screen.getByRole('button', { name: /Export AGENTS.md/i });
    expect(download).toBeEnabled();

    fireEvent.click(download);

    await waitFor(() => {
      expect(createZip).toHaveBeenCalledTimes(1);
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    const trackMock = vi.mocked(track);
    expect(trackMock).toHaveBeenCalledWith('workbench_export_download', {
      targetIds: ['agents-md'],
      fileCount: 1,
      entrySource: 'direct',
      time_to_export_ms: 1200,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(trackMock).toHaveBeenCalledWith('workbench_export_copy', {
        path: 'AGENTS.md',
        targetId: 'agents-md',
        entrySource: 'direct',
      });
    });
  });

  it('shows an error when compilation fails', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid payload' }),
    });

    render(<ExportPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Compile/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid payload')).toBeInTheDocument();
    });
  });

  it('shows compatibility warnings for unsupported scopes and skills', () => {
    act(() => {
      const store = useWorkbenchStore.getState();
      store.setUam({
        ...store.uam,
        scopes: [
          { id: 'global', kind: 'global', name: 'Global' },
          { id: 'dir-scope', kind: 'dir', dir: 'src' },
          { id: 'glob-scope', kind: 'glob', patterns: ['**/*.md'] },
        ],
        blocks: [
          { id: 'block-global', scopeId: 'global', kind: 'markdown', body: 'Root rules' },
          { id: 'block-dir', scopeId: 'dir-scope', kind: 'markdown', body: 'Dir rules' },
          { id: 'block-glob', scopeId: 'glob-scope', kind: 'markdown', body: 'Glob rules' },
        ],
        capabilities: [{ id: 'cap-1', title: 'Skill', description: 'Demo', params: {} }],
        targets: [
          createUamTargetV1('agents-md'),
          createUamTargetV1('github-copilot'),
          createUamTargetV1('gemini-cli'),
        ],
      });
    });

    render(<ExportPanel />);

    expect(screen.getByText('Compatibility')).toBeInTheDocument();
    expect(screen.getByTestId('compatibility-matrix')).toBeInTheDocument();
    expect(screen.getByText(/does not support glob scopes/i)).toBeInTheDocument();
    expect(screen.getByText(/does not support directory scopes/i)).toBeInTheDocument();
    expect(screen.getByText(/does not export skills/i)).toBeInTheDocument();
  });
});
