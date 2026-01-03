import dns from "node:dns/promises";
import net from "node:net";

export type DnsLookup = typeof dns.lookup;

export type SafeFetchOptions = {
  fetchImpl?: typeof fetch;
  dnsLookup?: DnsLookup;
  allowedUrls: string[];
  headers?: Record<string, string>;
};

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((v) => Number.parseInt(v, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;

  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local (fc00::/7)
  return false;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) return isPrivateIpv4(ip);
  if (net.isIP(ip) === 6) return isPrivateIpv6(ip);
  return true;
}

export async function assertSafeUrl(url: string, dnsLookup: DnsLookup): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Blocked non-http(s) URL: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`Blocked localhost URL: ${url}`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`Blocked private IP URL: ${url}`);
    return;
  }

  const records = await dnsLookup(hostname, { all: true });
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error(`Blocked private IP resolution (${record.address}) for URL: ${url}`);
    }
  }
}

export async function safeFetch(url: string, options: SafeFetchOptions): Promise<Response> {
  const allowed = new Set(options.allowedUrls);
  if (!allowed.has(url)) {
    throw new Error(`Blocked URL not present in allowlist: ${url}`);
  }

  const lookup = options.dnsLookup ?? dns.lookup;
  await assertSafeUrl(url, lookup);

  const fetchImpl = options.fetchImpl ?? fetch;

  const res = await fetchImpl(url, {
    method: "GET",
    redirect: "manual",
    headers: options.headers,
  });

  if (res.status !== 304 && res.status >= 300 && res.status < 400) {
    throw new Error(`Blocked redirect (${res.status}) for URL: ${url}`);
  }

  return res;
}
