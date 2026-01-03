import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/artifacts/fork/route';
import { requireSession } from '@/lib/requireSession';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/requireSession', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    artifact: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('POST /api/artifacts/fork', () => {
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

  it('forks an artifact successfully', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u2' } } });
    
    // Mock original artifact
    (prisma.artifact.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      title: 'Original',
      description: 'Desc',
      type: 'ARTIFACT',
      visibility: 'PUBLIC',
      userId: 'u1',
      tags: ['tag1'],
      versions: [{ version: '1', uam: { foo: 'bar' } }],
    });

    // Mock create response
    (prisma.artifact.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'fork1',
      title: 'Fork of Original',
      userId: 'u2',
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ artifactId: 'a1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('fork1');

    // Verify create call
    expect(prisma.artifact.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Fork of Original',
        userId: 'u2',
        forkedFromId: 'a1',
        versions: expect.objectContaining({
          create: expect.objectContaining({
            uam: { foo: 'bar' },
            message: expect.stringContaining('Forked from a1'),
          }),
        }),
      }),
    }));

    // Verify copy count increment
    expect(prisma.artifact.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'a1' },
      data: { copies: { increment: 1 } },
    }));
  });

  it('prevents forking private artifact of another user', async () => {
    (requireSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ session: { user: { id: 'u2' } } });
    
    (prisma.artifact.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      visibility: 'PRIVATE',
      userId: 'u1', // Different user
      versions: [{}],
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ artifactId: 'a1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
