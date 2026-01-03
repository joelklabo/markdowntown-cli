import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '@/app/api/artifacts/[id]/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  hasDatabaseEnv: true,
  prisma: {
    artifact: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('/api/artifacts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when missing', async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.artifact.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('forbids private reads for non-owners', async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u2' } });
    (prisma.artifact.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      visibility: 'PRIVATE',
      versions: [],
    });

    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(403);
  });

  it('returns latest version for public artifacts', async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.artifact.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      visibility: 'PUBLIC',
      versions: [{ id: 'v1', version: '1', uam: { foo: 'bar' }, message: null, createdAt: new Date() }],
    });

    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.latestVersion.version).toBe('1');
  });

  it('rejects visibility updates when logged out', async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ visibility: 'PUBLIC' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects visibility updates for non-owners', async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u2' } });
    (prisma.artifact.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', userId: 'u1' });

    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ visibility: 'PUBLIC' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(403);
  });

  it('updates visibility for owners', async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' } });
    (prisma.artifact.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', userId: 'u1' });
    (prisma.artifact.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', visibility: 'UNLISTED' });

    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ visibility: 'UNLISTED' }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(200);
    expect(prisma.artifact.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1' } }));
  });
});
