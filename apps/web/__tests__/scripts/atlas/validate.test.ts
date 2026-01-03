import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateAtlas } from "../../../scripts/atlas/validate";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

describe("scripts/atlas/validate", () => {
  it("passes for a minimal valid atlas directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdt-atlas-"));
    const atlasDir = path.join(tmpDir, "atlas");
    fs.mkdirSync(atlasDir, { recursive: true });

    writeJson(path.join(atlasDir, "crosswalk.json"), {
      schemaVersion: 1,
      crosswalk: { "repo-instructions": { cursor: [".cursorrules"] } },
    });

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
        "    expectedPhrases: ['.cursorrules']",
        "    trust: official",
      ].join("\n"),
      "utf8"
    );

    writeJson(path.join(atlasDir, "facts", "cursor.json"), {
      schemaVersion: 1,
      platformId: "cursor",
      name: "Cursor",
      retrievedAt: "2025-12-17T00:00:00Z",
      lastVerified: "2025-12-17T00:00:00Z",
      artifacts: [],
      claims: [
        {
          id: "cursor.repo.instructions",
          statement: "Cursor supports repo instructions via .cursorrules.",
          confidence: "high",
          evidence: [{ url: "https://example.com/cursor" }],
          features: ["repo-instructions"],
        },
      ],
      featureSupport: {
        "repo-instructions": "yes",
      },
    });

    expect(validateAtlas(atlasDir)).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails when featureSupport contains unknown keys", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdt-atlas-"));
    const atlasDir = path.join(tmpDir, "atlas");
    fs.mkdirSync(atlasDir, { recursive: true });

    writeJson(path.join(atlasDir, "crosswalk.json"), {
      schemaVersion: 1,
      crosswalk: { "repo-instructions": { cursor: [".cursorrules"] } },
    });

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
        "    expectedPhrases: ['.cursorrules']",
        "    trust: official",
      ].join("\n"),
      "utf8"
    );

    writeJson(path.join(atlasDir, "facts", "cursor.json"), {
      schemaVersion: 1,
      platformId: "cursor",
      name: "Cursor",
      retrievedAt: "2025-12-17T00:00:00Z",
      lastVerified: "2025-12-17T00:00:00Z",
      artifacts: [],
      claims: [],
      featureSupport: {
        "not-a-feature": "yes",
      },
    });

    const errors = validateAtlas(atlasDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/Unknown featureSupport key/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
