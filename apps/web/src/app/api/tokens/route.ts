import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/requireSession";
import { issueCliToken, DEFAULT_CLI_SCOPES } from "@/lib/cli/tokens";
import { checkRateLimit } from "@/lib/rateLimiter";

const createSchema = z.object({
  label: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const limitResponse = checkRateLimit(`tokens:create:${session.user.id}`, {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const json = await req.json();
  const body = createSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await issueCliToken({
    userId: session.user.id,
    label: body.data.label,
    scopes: [...DEFAULT_CLI_SCOPES],
  });

  return NextResponse.json(result);
}