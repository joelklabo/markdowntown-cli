import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TranslatePage from '@/app/translate/page';

// Mock createZip which is imported
vi.mock('@/lib/compile/zip', () => ({
  createZip: vi.fn().mockResolvedValue(new Blob([])),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:url');
global.URL.revokeObjectURL = vi.fn();

describe('TranslatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders input and output sections', async () => {
    const jsx = await TranslatePage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText(/Step 2/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Results/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compile/i })).toBeInTheDocument();
  });

  it('detects markdown format', async () => {
    const jsx = await TranslatePage({ searchParams: Promise.resolve({}) });
    render(jsx);
    const textarea = screen.getByPlaceholderText(/Paste Markdown/i);
    fireEvent.change(textarea, { target: { value: '# Hello' } });
    expect(screen.getByText(/Detected: Markdown/i)).toBeInTheDocument();
  });

  it('detects UAM v1 (JSON) format', async () => {
    const jsx = await TranslatePage({ searchParams: Promise.resolve({}) });
    render(jsx);
    const textarea = screen.getByPlaceholderText(/Paste Markdown/i);
    const uam = JSON.stringify({ schemaVersion: 1, meta: { title: 'Test' }, scopes: [], blocks: [] });
    fireEvent.change(textarea, { target: { value: uam } });
    expect(screen.getByText(/Detected: UAM v1 \(JSON\)/i)).toBeInTheDocument();
  });

  it('preselects target from query params', async () => {
    const jsx = await TranslatePage({ searchParams: Promise.resolve({ target: 'github-copilot' }) });
    render(jsx);

    const agents = screen.getByLabelText(/AGENTS\.md/i) as HTMLInputElement;
    const copilot = screen.getByLabelText(/GitHub Copilot/i) as HTMLInputElement;

    expect(agents.checked).toBe(false);
    expect(copilot.checked).toBe(true);
  });

  it('loads example content from query params', async () => {
    const jsx = await TranslatePage({
      searchParams: Promise.resolve({ example: 'claude-code/CLAUDE.md', target: 'github-copilot' }),
    });
    render(jsx);

    const textarea = screen.getByPlaceholderText(/Paste Markdown/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('CLAUDE.md');
  });

  it('shows a helpful error for unknown examples', async () => {
    const jsx = await TranslatePage({
      searchParams: Promise.resolve({ example: 'claude-code/DOES_NOT_EXIST.md', target: 'github-copilot' }),
    });
    render(jsx);
    expect(screen.getByText(/Example not found/i)).toBeInTheDocument();
  });

  it('compiles and shows results', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [{ path: 'AGENTS.md', content: '# Hello' }],
        warnings: [],
        info: [],
      }),
    });

    const jsx = await TranslatePage({ searchParams: Promise.resolve({}) });
    render(jsx);
    const textarea = screen.getByPlaceholderText(/Paste Markdown/i);
    fireEvent.change(textarea, { target: { value: '# Hello' } });
    
    const button = screen.getByRole('button', { name: /Compile/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('AGENTS.md')).toBeInTheDocument();
      expect(screen.getByText('# Hello')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/compile',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
