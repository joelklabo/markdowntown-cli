import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  const url = new URL(req.url);
  const versionId = url.searchParams.get('versionId');
  const cursor = url.searchParams.get('cursor');
  const limitRaw = url.searchParams.get('limit');
  const limit = Math.min(Math.max(Number.parseInt(limitRaw ?? '50', 10) || 50, 1), 100);

  const { id: idOrSlug } = await context.params;
  const artifact = await prisma.artifact.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, visibility: true, userId: true },
  });

  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  const isOwner = viewerId !== null && artifact.userId === viewerId;
  if (artifact.visibility === 'PRIVATE' && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (versionId) {
    const version = await prisma.artifactVersion.findFirst({
      where: { id: versionId, artifactId: artifact.id },
      select: {
        id: true,
        version: true,
        message: true,
        createdAt: true,
        uam: true,
        compiled: true,
        lint: true,
      },
    });

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    return NextResponse.json({ artifactId: artifact.id, version });
  }

  const versions = await prisma.artifactVersion.findMany({
    where: { artifactId: artifact.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      version: true,
      message: true,
      createdAt: true,
    },
  });

  const nextCursor = versions.length === limit ? versions[versions.length - 1]?.id ?? null : null;

  return NextResponse.json({ artifactId: artifact.id, versions, nextCursor });
}
