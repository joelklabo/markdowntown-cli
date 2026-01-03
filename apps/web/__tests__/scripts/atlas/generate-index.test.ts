import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateAtlasSearchIndex } from "../../../scripts/atlas/generate-index";

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function writeText(filePath: string, value: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

describe("generateAtlasSearchIndex", () => {
  it("writes deterministic output with stable ordering", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "markdowntown-atlas-index-"));
    const atlasDir = path.join(tmp, "atlas");

    writeJson(path.join(atlasDir, "facts", "cursor.json"), {
      schemaVersion: 1,
      platformId: "cursor",
      name: "Cursor",
      retrievedAt: "2025-12-17T00:00:00.000Z",
      lastVerified: "2025-12-17T00:00:00.000Z",
      artifacts: [
        {
          kind: "cursor-rules",
          label: "Project rules",
          paths: [".cursor/rules/*.mdc"],
          docs: "https://example.com/docs/rules",
        },
      ],
      claims: [
        {
          id: "cursor.rules.paths",
          statement: "Cursor loads project rules from .cursor/rules/*.mdc.",
          confidence: "high",
          evidence: [{ url: "https://example.com/docs/rules", excerpt: "Rules live under .cursor/rules/*.mdc." }],
          features: ["repo-instructions"],
          artifacts: ["cursor-rules"],
        },
      ],
      featureSupport: { "repo-instructions": "yes" },
    });

    writeText(path.join(atlasDir, "guides", "concepts", "scoping.mdx"), "# Scoping\n");
    writeText(path.join(atlasDir, "guides", "recipes", "safe-shell-commands.mdx"), "# Safe shell commands\n");
    writeText(path.join(atlasDir, "examples", "cursor", "basic.md"), "Example\n");

    const nowIso = "2025-12-17T12:34:56.000Z";
    const outFile = path.join(tmp, "index.json");

    const first = generateAtlasSearchIndex({ atlasDir, outFile, now: () => new Date(nowIso) });
    const second = generateAtlasSearchIndex({ atlasDir, outFile, now: () => new Date(nowIso) });

    const firstText = fs.readFileSync(first.outFile, "utf8");
    const secondText = fs.readFileSync(second.outFile, "utf8");
    expect(secondText).toBe(firstText);

    expect(first.index.schemaVersion).toBe(1);
    expect(first.index.generatedAt).toBe(nowIso);
    expect(first.index.items.map((item) => item.id)).toEqual([
      "platform:cursor",
      "guide:concepts:scoping",
      "guide:recipes:safe-shell-commands",
      "example:cursor:basic.md",
      "artifact:cursor:cursor-rules",
      "claim:cursor:cursor.rules.paths",
    ]);
  });
});

