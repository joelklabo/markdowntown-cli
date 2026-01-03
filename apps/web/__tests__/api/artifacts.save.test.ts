import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/artifacts/save/route';
import { requireSession } from '@/lib/requireSession';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/requireSession', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    artifact: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    artifactVersion: {
      findMany: vi.fn(),
    },
  },
}));

describe('POST /api/artifacts/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized requests', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      response: new Response(null, { status: 401 }),
    });
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('creates new artifact', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });
    (prisma.artifact.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1' });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Agent',
        uam: {
          schemaVersion: 1,
          meta: { title: 'New Agent' },
          scopes: [
            { id: 'global', kind: 'global' },
            { id: 'docs', kind: 'dir', dir: 'docs' },
          ],
          blocks: [],
          targets: [
            { targetId: 'github-copilot', adapterVersion: '1', options: {} },
            { targetId: 'agents-md', adapterVersion: '1', options: {} },
          ],
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.artifact.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'New Agent',
        targets: ['agents-md', 'github-copilot'],
        hasScopes: true,
        userId: 'u1',
        versions: expect.any(Object),
      }),
    }));
  });

  it('requires secret scan ack for public saves', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Public Agent',
        visibility: 'PUBLIC',
        uam: {
          schemaVersion: 1,
          meta: { title: 'Public Agent' },
          scopes: [],
          blocks: [],
          targets: [{ targetId: 'agents-md', adapterVersion: '1', options: {} }],
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Secret scan acknowledgement required');
  });

  it('allows public saves with secret scan ack', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });
    (prisma.artifact.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1' });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Public Agent',
        visibility: 'PUBLIC',
        secretScanAck: true,
        uam: {
          schemaVersion: 1,
          meta: { title: 'Public Agent' },
          scopes: [],
          blocks: [],
          targets: [{ targetId: 'agents-md', adapterVersion: '1', options: {} }],
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('updates existing artifact', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });
    (prisma.artifact.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    (prisma.artifactVersion.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ version: '1' }]);
    (prisma.artifact.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1' });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        id: 'a1',
        title: 'Updated Agent',
        expectedVersion: '1',
        uam: {
          schemaVersion: 1,
          meta: { title: 'Updated Agent' },
          scopes: [
            { id: 'global', kind: 'global' },
            { id: 'src', kind: 'glob', patterns: ['src/**/*.ts'] },
          ],
          blocks: [],
          targets: [{ targetId: 'agents-md', adapterVersion: '1', options: {} }],
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.artifact.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'a1' },
      data: expect.objectContaining({
        title: 'Updated Agent',
        targets: ['agents-md'],
        hasScopes: true,
        versions: expect.objectContaining({
          create: expect.objectContaining({
            version: '2',
          }),
        }),
      }),
    }));
  });

  it('forbids updates for non-owners', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u2' } } });
    (prisma.artifact.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', userId: 'u1' });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        id: 'a1',
        title: 'Updated Agent',
        uam: { schemaVersion: 1, meta: { title: 'Updated Agent' }, scopes: [], blocks: [] },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns conflict on stale version', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });
    (prisma.artifact.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    (prisma.artifactVersion.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ version: '2' }]);

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        id: 'a1',
        title: 'Stale Agent',
        expectedVersion: '1',
        uam: { schemaVersion: 1, meta: { title: 'Stale Agent' }, scopes: [], blocks: [] },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.details).toEqual(
      expect.objectContaining({
        currentVersion: '2',
        expectedVersion: '1',
      }),
    );
  });

  it('returns conflict on stale updatedAt', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });
    (prisma.artifact.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    (prisma.artifactVersion.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ version: '3' }]);

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        id: 'a1',
        title: 'Stale Timestamp',
        expectedUpdatedAt: '2023-12-31T00:00:00.000Z',
        uam: { schemaVersion: 1, meta: { title: 'Stale Timestamp' }, scopes: [], blocks: [] },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.details).toEqual(
      expect.objectContaining({
        currentVersion: '3',
        expectedUpdatedAt: '2023-12-31T00:00:00.000Z',
      }),
    );
  });

  it('rejects invalid UAM payloads', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Bad Agent',
        uam: { schemaVersion: 999, meta: { title: 'Bad Agent' } },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects unknown target configurations', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u1' } } });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Agent',
        uam: {
          schemaVersion: 1,
          meta: { title: 'Agent' },
          scopes: [],
          blocks: [],
          targets: [{ targetId: 'unknown', adapterVersion: '1', options: {} }],
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
