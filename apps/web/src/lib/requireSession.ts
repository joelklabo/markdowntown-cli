import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "./auth";

type SessionWithUser = Session & { user: { id: string } };

type RequireSessionResult =
  | { session: SessionWithUser; response?: undefined }
  | { session?: undefined; response: NextResponse };

/**
 * Ensure a valid session exists. Returns a 401 JSON response when missing
 * so handlers can early-return without repeating boilerplate.
 */
export async function requireSession(): Promise<RequireSessionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
        },
      }
    );
    return { response };
  }
  return { session: session as SessionWithUser };
}
