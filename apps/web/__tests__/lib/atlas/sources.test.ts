import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAtlasSources, parseAtlasSourcesYaml } from "@/lib/atlas/sources";

describe("atlas/sources", () => {
  it("parses and validates atlas/sources.yml", () => {
    const sources = loadAtlasSources();
    expect(sources.schemaVersion).toBe(1);
    expect(Array.isArray(sources.sources)).toBe(true);
    expect(sources.sources.length).toBeGreaterThan(0);
  });

  it("normalizes expectedPhrases and rejects invalid platform ids", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdt-atlas-"));
    const atlasDir = path.join(tmpDir, "atlas");
    fs.mkdirSync(atlasDir, { recursive: true });

    fs.writeFileSync(
      path.join(atlasDir, "sources.yml"),
      [
        "schemaVersion: 1",
        "sources:",
        "  - id: cursor-docs",
        "    platformId: cursor",
        "    kind: docs",
        "    url: https://example.com/cursor",
        "    cadence: monthly",
        "    expectedPhrases: [' .cursorrules ', '.cursorrules']",
        "    trust: official",
      ].join("\n"),
      "utf8"
    );

    const parsed = loadAtlasSources({ atlasDir });
    expect(parsed.sources[0].expectedPhrases).toEqual([".cursorrules"]);

    const badYaml = [
      "schemaVersion: 1",
      "sources:",
      "  - id: bad-platform",
      "    platformId: not-a-platform",
      "    kind: docs",
      "    url: https://example.com/bad",
      "    cadence: monthly",
      "    expectedPhrases: ['x']",
      "    trust: low",
    ].join("\n");

    expect(() => parseAtlasSourcesYaml(badYaml)).toThrow();
  });
});

