import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/artifacts/[id]/versions/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    artifact: {
      findFirst: vi.fn(),
    },
    artifactVersion: {
      findMany: vi.fn(),
    },
  },
}));

describe('/api/artifacts/[id]/versions', () => {
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
    });

    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(403);
  });

  it('lists versions for public artifacts', async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.artifact.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      visibility: 'PUBLIC',
    });
    (prisma.artifactVersion.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'v1', version: '1', message: 'init', createdAt: new Date() },
    ]);

    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.versions).toHaveLength(1);
    expect(json.versions[0].version).toBe('1');
  });
});
