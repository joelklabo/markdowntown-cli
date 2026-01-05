import { NextResponse } from "next/server";
import type { CliToken } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractBearerToken, findCliToken, getMissingCliScopes, isCliTokenExpired } from "@/lib/auth/cliToken";

export type RequireCliTokenResult =
  | { token: CliToken; response?: undefined }
  | { token?: undefined; response: NextResponse };

function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json(
    { error: message },
    {
      status: 401,
      headers: {
        "Cache-Control": "private, no-store",
        "WWW-Authenticate": "Bearer error=\"invalid_token\"",
      },
    }
  );
}

export async function requireCliToken(request: Request, scopes: string[] = []): Promise<RequireCliTokenResult> {
  const header = request.headers.get("authorization");
  const token = extractBearerToken(header);
  if (!token) {
    return { response: unauthorizedResponse() };
  }

  const record = await findCliToken(token);
  if (!record || record.revokedAt) {
    return { response: unauthorizedResponse() };
  }

  if (isCliTokenExpired(record)) {
    return { response: unauthorizedResponse("Token expired") };
  }

  const missing = getMissingCliScopes(record, scopes);
  if (missing.length > 0) {
    return { response: NextResponse.json({ error: "Missing scopes", missing }, { status: 403 }) };
  }

  await prisma.cliToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return { token: record };
}
