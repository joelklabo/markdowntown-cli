import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimiter";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

function getAllowlist(): string[] {
  try {
    const registryPath = path.resolve(process.cwd(), "../../cli/data/doc-sources.json");
    const content = fs.readFileSync(registryPath, "utf8");
    const registry = JSON.parse(content);
    return registry.allowlistHosts || [];
  } catch (error) {
    console.error("Failed to load fetch allowlist:", error);
    return [];
  }
}

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

    const allowlist = getAllowlist();
    const host = targetUrl.hostname.toLowerCase();
    const isAllowed = allowlist.some(allowed => host === allowed.toLowerCase());

    if (!isAllowed) {
      return NextResponse.json({ error: `Host not allowlisted: ${host}` }, { status: 403 });
    }
    
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
