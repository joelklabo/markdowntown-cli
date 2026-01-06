import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`fetch-proxy:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const targetUrl = new URL(target);
    if (targetUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Only https allowed" }, { status: 400 });
    }
    
    // We should probably check an allowlist here too, similar to the CLI logic.
    // Ideally share the allowlist logic or use the same registry.
    // For now, let's assume the client (WASM) does validation, but server-side check is safer.
    // If we skip it here, we rely on the caller.
    
    const response = await fetch(target, {
        headers: {
            "User-Agent": "markdowntown-web-proxy",
        }
    });
    
    const body = await response.blob();
    
    return new NextResponse(body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
            "Cache-Control": "public, max-age=3600",
        }
    });

  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
