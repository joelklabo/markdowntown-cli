import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ALLOWED_PREFIXES = ["/api/public", "/api/health", "/api/auth"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isBypassed(pathname: string) {
  if (!pathname.startsWith("/api/")) return true;
  return ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function traceIdFromCrypto(): string {
  try {
    const maybeCrypto = globalThis.crypto as Crypto | undefined;
    if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID();
  } catch {
    // ignore
  }
  return `trace_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const traceId = req.headers.get("x-trace-id") ?? traceIdFromCrypto();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-trace-id", traceId);

  if (isBypassed(pathname) || SAFE_METHODS.has(req.method)) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-trace-id", traceId);
    return res;
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
          "x-trace-id": traceId,
        },
      }
    );
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-trace-id", traceId);
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
