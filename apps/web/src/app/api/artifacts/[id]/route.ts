import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { auditLog, withAPM } from '@/lib/observability';
import { prisma, hasDatabaseEnv } from '@/lib/prisma';
import { getPublicItem } from '@/lib/publicItems';
import { Visibility } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  return withAPM(_req, async () => {
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id ?? null;

    const { id: idOrSlug } = await context.params;

    if (!hasDatabaseEnv) {
      const fallback = await getPublicItem(idOrSlug);
      if (!fallback) {
        return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
      }
      return NextResponse.json({
        artifact: {
          id: fallback.id,
          slug: fallback.slug,
          visibility: 'PUBLIC',
          tags: fallback.tags,
        },
        latestVersion: { uam: fallback.content },
      });
    }

    const artifact = await prisma.artifact.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    const isOwner = viewerId !== null && artifact.userId === viewerId;
    if (artifact.visibility === 'PRIVATE' && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const latestVersion = artifact.versions[0] ?? null;
    return NextResponse.json({ artifact, latestVersion });
  });
}

const PatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    visibility: z.nativeEnum(Visibility).optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No fields provided' });

export async function PATCH(req: Request, context: RouteContext) {
  return withAPM(req, async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const { id: idOrSlug } = await context.params;
    const existing = await prisma.artifact.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.artifact.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
        ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
      },
    });

    auditLog('artifact_meta_update', {
      actorId: session.user.id,
      artifactId: existing.id,
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
      ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
    });

    return NextResponse.json(updated);
  });
}
