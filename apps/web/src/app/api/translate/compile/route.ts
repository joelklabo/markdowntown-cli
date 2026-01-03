import { NextResponse } from 'next/server';
import { compile, validateTargets } from '@/lib/uam/compile';
import { UniversalAgentDefinitionSchema } from '@/lib/uam/schema';
import { z } from 'zod';

// This endpoint compiles the legacy UniversalAgentDefinition schema (pre-UAM v1).
const RequestSchema = z.object({
  definition: UniversalAgentDefinitionSchema,
  targets: z.array(z.string()),
});

const MAX_INPUT_BYTES = 250_000;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(JSON.stringify(json)).byteLength;
    if (inputBytes > MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: 'Payload too large. Please reduce the input size.', maxBytes: MAX_INPUT_BYTES, bytes: inputBytes },
        { status: 413 }
      );
    }

    const body = RequestSchema.safeParse(json);

    if (!body.success) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const { valid, invalid } = validateTargets(body.data.targets);
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: 'Unknown target selection', invalidTargets: invalid },
        { status: 400 }
      );
    }
    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'No valid targets selected' },
        { status: 400 }
      );
    }

    const result = await compile(body.data.definition, valid);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Compilation error:', message);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
