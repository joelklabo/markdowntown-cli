import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArtifactDetailPage from '@/app/a/[slug]/page';

vi.mock('@/lib/publicItems', () => ({
  getPublicItem: vi.fn().mockResolvedValue({
    id: '1',
    slug: 'test-artifact',
    title: 'Test Artifact',
    description: 'Desc',
    type: 'agent',
    tags: ['ai'],
    targets: ['agents-md'],
    hasScopes: true,
    lintGrade: 'A',
    scopeCount: 1,
    blockCount: 2,
    version: '2',
    content: { schemaVersion: 1, meta: { title: 'UAM v2' }, scopes: [], blocks: [] },
    stats: { views: 0, copies: 0, votes: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}));

describe('ArtifactPage', () => {
  it('renders artifact details', async () => {
    const jsx = await ArtifactDetailPage({ params: Promise.resolve({ slug: 'test-artifact' }) });
    render(jsx);
    
    expect(screen.getAllByText('Test Artifact').length).toBeGreaterThan(0);
    expect(screen.getByText('agents-md')).toBeInTheDocument();
    expect(screen.getByText('Rendered')).toBeInTheDocument();
    expect(screen.getByText('Raw')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Lint')).toBeInTheDocument();
    expect(screen.getByText('Diff')).toBeInTheDocument();
    expect(screen.getByText('Versions')).toBeInTheDocument();
  });

  it('switches versions and updates content', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/artifacts/1/versions?versionId=v1')) {
        return {
          ok: true,
          json: async () => ({
            version: {
              id: 'v1',
              version: '1',
              message: 'init',
              createdAt: new Date().toISOString(),
              uam: { schemaVersion: 1, meta: { title: 'UAM v1' }, scopes: [], blocks: [] },
            },
          }),
        } as Response;
      }

      if (url.includes('/api/artifacts/1/versions')) {
        return {
          ok: true,
          json: async () => ({
            versions: [
              { id: 'v2', version: '2', message: 'second', createdAt: new Date().toISOString() },
              { id: 'v1', version: '1', message: 'init', createdAt: new Date().toISOString() },
            ],
          }),
        } as Response;
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as unknown as typeof fetch;

    const jsx = await ArtifactDetailPage({ params: Promise.resolve({ slug: 'test-artifact' }) });
    render(jsx);

    const user = userEvent.setup();
    await user.click(screen.getByText('Versions'));
    await screen.findByRole('button', { name: 'Select version 1' });

    await user.click(screen.getByRole('button', { name: 'Select version 1' }));

    await user.click(screen.getByText('Raw'));
    await waitFor(() => {
      expect(screen.getByText(/UAM v1/)).toBeInTheDocument();
    });
  });

  it('renders a diff for the selected version', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/artifacts/1/versions?versionId=v1')) {
        return {
          ok: true,
          json: async () => ({
            version: {
              id: 'v1',
              version: '1',
              message: 'init',
              createdAt: new Date().toISOString(),
              uam: { schemaVersion: 1, meta: { title: 'UAM v1' }, scopes: [], blocks: [] },
            },
          }),
        } as Response;
      }

      if (url.includes('/api/artifacts/1/versions')) {
        return {
          ok: true,
          json: async () => ({
            versions: [
              { id: 'v2', version: '2', message: 'second', createdAt: new Date().toISOString() },
              { id: 'v1', version: '1', message: 'init', createdAt: new Date().toISOString() },
            ],
          }),
        } as Response;
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as unknown as typeof fetch;

    const jsx = await ArtifactDetailPage({ params: Promise.resolve({ slug: 'test-artifact' }) });
    render(jsx);

    const user = userEvent.setup();
    await user.click(screen.getByText('Diff'));
    const header = await screen.findByText('Comparing v1 → v2');
    await waitFor(() => {
      const container = header.parentElement;
      const pre = container?.querySelector('pre');
      expect(pre?.textContent).toMatch(/\+\s+.*UAM v2/);
      expect(pre?.textContent).toMatch(/-\s+.*UAM v1/);
    });
  });
});
