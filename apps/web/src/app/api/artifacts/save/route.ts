import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/requireSession';
import { auditLog, withAPM } from '@/lib/observability';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ArtifactType, Visibility, Prisma } from '@prisma/client';
import { safeParseUamV1 } from '@/lib/uam/uamValidate';
import { resolveAdapter } from '@/lib/adapters';

const SaveSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(ArtifactType).default('ARTIFACT'),
  visibility: z.nativeEnum(Visibility).default('PRIVATE'),
  tags: z.array(z.string()).default([]),
  uam: z.unknown(),
  compiled: z.unknown().optional(),
  lint: z.unknown().optional(),
  message: z.string().optional(),
  expectedVersion: z.union([z.string(), z.number()]).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
  secretScanAck: z.boolean().optional(),
});

export async function POST(req: Request) {
  return withAPM(req, async () => {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    try {
      const json = await req.json();
      const body = SaveSchema.parse(json);
      const requiresSecretAck = body.visibility === Visibility.PUBLIC || body.visibility === Visibility.UNLISTED;
      if (requiresSecretAck && body.secretScanAck !== true) {
        return NextResponse.json(
          {
            error: 'Secret scan acknowledgement required',
            details: { visibility: body.visibility },
          },
          { status: 400 },
        );
      }

      const parsedUam = safeParseUamV1(body.uam);
      if (!parsedUam.success) {
        return NextResponse.json({ error: 'Invalid UAM v1 payload', details: parsedUam.error.issues }, { status: 400 });
      }

      const invalidTargets = parsedUam.data.targets
        .filter(t => !resolveAdapter(t.targetId, t.adapterVersion))
        .map(t => ({ targetId: t.targetId, adapterVersion: t.adapterVersion }));
      if (invalidTargets.length > 0) {
        return NextResponse.json({ error: 'Invalid target configuration', details: invalidTargets }, { status: 400 });
      }

      const targetIds = Array.from(new Set(parsedUam.data.targets.map(t => t.targetId))).sort();
      const hasScopes = parsedUam.data.scopes.some(s => s.kind !== 'global');

      let artifact;

      if (body.id) {
        // Update existing
        const existing = await prisma.artifact.findUnique({
          where: { id: body.id },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
        }

        if (existing.userId !== session.user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Calculate current + next numeric version (stored as a string). Ignore non-numeric versions like "draft".
        const versions = await prisma.artifactVersion.findMany({
          where: { artifactId: body.id },
          select: { version: true },
        });
        const maxNumeric = versions.reduce((max, v) => {
          const parsed = Number.parseInt(v.version, 10);
          return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
        }, 0);
        const currentVersion = String(maxNumeric);
        const expectedVersion = body.expectedVersion !== undefined ? String(body.expectedVersion) : undefined;
        const currentUpdatedAt = existing.updatedAt instanceof Date ? existing.updatedAt : new Date(existing.updatedAt);
        const expectedUpdatedAt = body.expectedUpdatedAt ? new Date(body.expectedUpdatedAt) : undefined;
        const versionMismatch = !!expectedVersion && expectedVersion !== currentVersion;
        const updatedAtMismatch =
          !!expectedUpdatedAt && Number.isFinite(currentUpdatedAt.getTime()) && expectedUpdatedAt.getTime() !== currentUpdatedAt.getTime();
        if (versionMismatch || updatedAtMismatch) {
          return NextResponse.json(
            {
              error: 'Conflict',
              details: {
                currentVersion,
                updatedAt: Number.isFinite(currentUpdatedAt.getTime()) ? currentUpdatedAt.toISOString() : null,
                expectedVersion: expectedVersion ?? null,
                expectedUpdatedAt: body.expectedUpdatedAt ?? null,
              },
            },
            { status: 409 },
          );
        }
        const nextVersion = String(maxNumeric + 1);

        artifact = await prisma.artifact.update({
          where: { id: body.id },
          data: {
            title: body.title,
            description: body.description,
            visibility: body.visibility,
            tags: body.tags,
            targets: targetIds,
            hasScopes,
            versions: {
              create: {
                version: nextVersion,
                uam: parsedUam.data as unknown as Prisma.InputJsonValue, // JSON
                ...(body.compiled !== undefined ? { compiled: body.compiled as Prisma.InputJsonValue } : {}),
                ...(body.lint !== undefined ? { lint: body.lint as Prisma.InputJsonValue } : {}),
                message: body.message,
              },
            },
          },
        });

        auditLog('artifact_save', {
          actorId: session.user.id,
          action: 'update',
          artifactId: artifact.id,
          version: nextVersion,
          visibility: body.visibility,
        });
      } else {
        // Create new
        artifact = await prisma.artifact.create({
          data: {
            title: body.title,
            description: body.description,
            type: body.type,
            visibility: body.visibility,
            tags: body.tags,
            targets: targetIds,
            hasScopes,
            userId: session.user.id,
            versions: {
              create: {
                version: '1',
                uam: parsedUam.data as unknown as Prisma.InputJsonValue,
                ...(body.compiled !== undefined ? { compiled: body.compiled as Prisma.InputJsonValue } : {}),
                ...(body.lint !== undefined ? { lint: body.lint as Prisma.InputJsonValue } : {}),
                message: body.message ?? 'Initial version',
              },
            },
          },
        });

        auditLog('artifact_save', {
          actorId: session.user.id,
          action: 'create',
          artifactId: artifact.id,
          version: '1',
          visibility: body.visibility,
          type: body.type,
        });
      }

      return NextResponse.json(artifact);
    } catch (error) {
      console.error('Save artifact error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  });
}
