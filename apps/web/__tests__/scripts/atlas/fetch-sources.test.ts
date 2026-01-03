import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fetchAtlasSources } from "../../../scripts/atlas/fetch-sources";
import type { DnsLookup } from "../../../scripts/atlas/http";

function writeYaml(filePath: string, yaml: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml, "utf8");
}

describe("scripts/atlas/fetch-sources", () => {
  it("writes snapshots and meta for 200 responses", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdt-atlas-"));
    const atlasDir = path.join(tmpDir, "atlas");
    fs.mkdirSync(atlasDir, { recursive: true });

    writeYaml(
      path.join(atlasDir, "sources.yml"),
      [
        "schemaVersion: 1",
        "sources:",
        "  - id: cursor-docs",
        "    platformId: cursor",
        "    kind: docs",
        "    url: https://example.com/cursor",
        "    cadence: monthly",
        "    expectedPhrases: ['.cursorrules']",
        "    trust: official",
      ].join("\n")
    );

    const mockFetch = vi.fn(async () => {
      return new Response("<html>ok</html>", {
        status: 200,
        headers: {
          etag: "\"abc\"",
          "last-modified": "Wed, 17 Dec 2025 00:00:00 GMT",
        },
      });
    });

    const mockLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const now = () => new Date("2025-12-17T00:00:00.000Z");

    const result = await fetchAtlasSources({
      atlasDir,
      fetchImpl: mockFetch as unknown as typeof fetch,
      dnsLookup: mockLookup as unknown as DnsLookup,
      now,
    });
    expect(result).toEqual({ fetched: 1, skipped: 0, errors: 0 });

    const snapshotDir = path.join(atlasDir, "snapshots", "cursor-docs");
    const files = fs.readdirSync(snapshotDir);
    expect(files.some((f) => f.endsWith(".html"))).toBe(true);
    expect(files.some((f) => f.endsWith(".meta.json"))).toBe(true);

    const metaName = files.find((f) => f.endsWith(".meta.json"))!;
    const meta = JSON.parse(fs.readFileSync(path.join(snapshotDir, metaName), "utf8"));
    expect(meta.etag).toBe("\"abc\"");
    expect(meta.lastModified).toContain("Dec");
    expect(meta.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.fetchedAt).toBe("2025-12-17T00:00:00.000Z");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses conditional request headers when previous meta exists", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdt-atlas-"));
    const atlasDir = path.join(tmpDir, "atlas");
    fs.mkdirSync(atlasDir, { recursive: true });

    writeYaml(
      path.join(atlasDir, "sources.yml"),
      [
        "schemaVersion: 1",
        "sources:",
        "  - id: cursor-docs",
        "    platformId: cursor",
        "    kind: docs",
        "    url: https://example.com/cursor",
        "    cadence: monthly",
        "    expectedPhrases: ['.cursorrules']",
        "    trust: official",
      ].join("\n")
    );

    const snapshotDir = path.join(atlasDir, "snapshots", "cursor-docs");
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(
      path.join(snapshotDir, "2025-12-16T00-00-00.000Z.meta.json"),
      JSON.stringify(
        {
          url: "https://example.com/cursor",
          fetchedAt: "2025-12-16T00:00:00.000Z",
          etag: "\"prev\"",
          lastModified: "Tue, 16 Dec 2025 00:00:00 GMT",
          sha256: "0".repeat(64),
        },
        null,
        2
      ),
      "utf8"
    );

    const calls: Array<Record<string, string>> = [];
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push((init?.headers ?? {}) as Record<string, string>);
      return new Response(null, { status: 304 });
    });
    const mockLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);

    const result = await fetchAtlasSources({
      atlasDir,
      fetchImpl: mockFetch as unknown as typeof fetch,
      dnsLookup: mockLookup as unknown as DnsLookup,
      now: () => new Date("2025-12-17T00:00:00.000Z"),
    });
    expect(result).toEqual({ fetched: 0, skipped: 1, errors: 0 });
    expect(calls[0]["If-None-Match"]).toBe("\"prev\"");
    expect(calls[0]["If-Modified-Since"]).toContain("Dec");

    const filesAfter = fs.readdirSync(snapshotDir).filter((f) => f.endsWith(".meta.json"));
    expect(filesAfter).toHaveLength(1);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
