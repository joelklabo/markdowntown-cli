import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AtlasPlatformIdSchema } from '@/lib/atlas/schema';
import { AtlasExamplesZipError, createAtlasExamplesZip } from '@/lib/atlas/examplesZip';

const MAX_FILES = 25;
const MAX_TOTAL_BYTES = 512 * 1024;

const RequestSchema = z.object({
  files: z
    .array(
      z.object({
        platformId: AtlasPlatformIdSchema,
        fileName: z
          .string()
          .min(1)
          .regex(/^[a-z0-9][a-z0-9._-]*$/i, { message: 'fileName must be a safe filename' }),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = RequestSchema.safeParse(json);

    if (!body.success) {
      return NextResponse.json({ error: 'Invalid payload', details: body.error.issues }, { status: 400 });
    }

    const result = await createAtlasExamplesZip(body.data.files, {
      maxFiles: MAX_FILES,
      maxTotalBytes: MAX_TOTAL_BYTES,
    });

    return new NextResponse(new Uint8Array(result.zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="atlas-examples.zip"',
        'Content-Length': String(result.zip.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AtlasExamplesZipError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Atlas examples zip error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
