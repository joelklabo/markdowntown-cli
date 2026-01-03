import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractAtlasFacts } from "../../../scripts/atlas/extract-facts";

function writeYaml(filePath: string, yaml: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml, "utf8");
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

describe("scripts/atlas/extract-facts", () => {
  it("updates lastVerified only when extraction succeeds", async () => {
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
        "    expectedPhrases: ['MAGIC_PHRASE']",
        "    trust: official",
      ].join("\n")
    );

    const snapshotsDir = path.join(atlasDir, "snapshots", "cursor-docs");
    fs.mkdirSync(snapshotsDir, { recursive: true });
    fs.writeFileSync(path.join(snapshotsDir, "2025-12-16T00-00-00.000Z.html"), "<html>MAGIC_PHRASE</html>", "utf8");

    const factsPath = path.join(atlasDir, "facts", "cursor.json");
    writeJson(factsPath, {
      schemaVersion: 1,
      platformId: "cursor",
      name: "Cursor",
      retrievedAt: "2025-12-16T00:00:00Z",
      lastVerified: "2025-12-16T00:00:00Z",
      artifacts: [],
      claims: [],
      featureSupport: { "repo-instructions": "no", "path-scoping": "no", imports: "no" },
    });

    await extractAtlasFacts({ atlasDir, now: () => new Date("2025-12-17T00:00:00.000Z") });
    const updated = JSON.parse(fs.readFileSync(factsPath, "utf8"));
    expect(updated.lastVerified).toBe("2025-12-17T00:00:00.000Z");

    // Now break the snapshot and ensure lastVerified does not update.
    fs.writeFileSync(path.join(snapshotsDir, "2025-12-18T00-00-00.000Z.html"), "<html>nope</html>", "utf8");

    await expect(extractAtlasFacts({ atlasDir, now: () => new Date("2025-12-18T00:00:00.000Z") })).rejects.toThrow(
      /Missing expected phrases/
    );

    const afterFail = JSON.parse(fs.readFileSync(factsPath, "utf8"));
    expect(afterFail.lastVerified).toBe("2025-12-17T00:00:00.000Z");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

