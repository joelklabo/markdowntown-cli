import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const ForkSchema = z.object({
  artifactId: z.string().min(1),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession();
  if (response) {
    return response;
  }

  try {
    const json = await req.json();
    const body = ForkSchema.parse(json);

    // Fetch original
    const original = await prisma.artifact.findUnique({
      where: { id: body.artifactId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    if (original.visibility === 'PRIVATE' && original.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const latestVersion = original.versions[0];
    if (!latestVersion) {
      return NextResponse.json({ error: 'Original artifact has no versions' }, { status: 400 });
    }

    // Create fork
    const fork = await prisma.artifact.create({
      data: {
        title: `Fork of ${original.title}`,
        description: original.description,
        type: original.type,
        visibility: 'PRIVATE',
        tags: original.tags,
        forkedFromId: original.id,
        userId: session.user.id,
        versions: {
          create: {
            version: '1',
            uam: latestVersion.uam as Prisma.InputJsonValue,
            message: `Forked from ${original.id} v${latestVersion.version}`,
          },
        },
      },
    });

    // Update copy stats on original
    await prisma.artifact.update({
      where: { id: original.id },
      data: { copies: { increment: 1 } },
    });

    return NextResponse.json(fork);
  } catch (error) {
    console.error('Fork error:', error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
