import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAPM } from '@/lib/observability';
import { rateLimit } from '@/lib/rateLimiter';
import { compileUamV1 } from '@/lib/compile/compile';
import { UamTargetV1Schema, UamV1Schema } from '@/lib/uam/uamValidate';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  uam: UamV1Schema,
  targets: z.array(UamTargetV1Schema).optional(),
});

const MAX_INPUT_BYTES = 500_000;
const MAX_OUTPUT_FILES = 200;
const MAX_OUTPUT_BYTES = 2_000_000;

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: Request) {
  return withAPM(request, async () => {
    const ip = getClientIp(request);
    if (!rateLimit(`compile:${ip}`)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const json = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(JSON.stringify(parsed.data)).byteLength;
    if (inputBytes > MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: 'Payload too large', maxBytes: MAX_INPUT_BYTES, bytes: inputBytes },
        { status: 413 }
      );
    }

    const { uam, targets } = parsed.data;

    try {
      const result = await compileUamV1(uam, targets ?? uam.targets);

      if (result.files.length > MAX_OUTPUT_FILES) {
        return NextResponse.json(
          { error: 'Too many output files', maxFiles: MAX_OUTPUT_FILES, files: result.files.length },
          { status: 413 }
        );
      }

      const outputBytes = result.files.reduce((sum, f) => sum + encoder.encode(f.content).byteLength, 0);
      if (outputBytes > MAX_OUTPUT_BYTES) {
        return NextResponse.json(
          { error: 'Compiled output too large', maxBytes: MAX_OUTPUT_BYTES, bytes: outputBytes },
          { status: 413 }
        );
      }

      return NextResponse.json(result);
    } catch (error) {
      console.error('Compile error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  });
}

