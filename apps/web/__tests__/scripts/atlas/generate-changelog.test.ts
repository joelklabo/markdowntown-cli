import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateAtlasChangelog } from "../../../scripts/atlas/generate-changelog";
import type { AtlasChangelogEntry } from "../../../scripts/atlas/generate-changelog";

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

describe("generateAtlasChangelog", () => {
  it("writes per-platform changelog entries and a markdown summary", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "markdowntown-atlas-"));
    const atlasDir = path.join(tmp, "atlas");
    const factsDir = path.join(atlasDir, "facts");
    const beforeFactsDir = path.join(tmp, "before-facts");

    const beforeFacts = {
      schemaVersion: 1,
      platformId: "claude-code",
      name: "Claude Code",
      retrievedAt: "2025-12-16T00:00:00.000Z",
      lastVerified: "2025-12-16T00:00:00.000Z",
      artifacts: [],
      claims: [
        {
          id: "claude-code.repo-instructions.claude-md",
          statement: "Claude Code uses CLAUDE.md as project memory.",
          confidence: "medium",
          evidence: [{ url: "https://example.com/claude", title: "Docs", excerpt: "CLAUDE.md" }],
          features: ["repo-instructions"],
        },
      ],
      featureSupport: { "repo-instructions": "yes", "path-scoping": "no", imports: "no" },
    };

    const afterFacts = {
      ...beforeFacts,
      lastVerified: "2025-12-17T00:00:00.000Z",
      claims: [
        { ...beforeFacts.claims[0], confidence: "high" },
        {
          id: "claude-code.path-scoping.directory-memory",
          statement: "Claude Code supports directory memory via nested CLAUDE.md.",
          confidence: "medium",
          evidence: [{ url: "https://example.com/claude", title: "Docs", excerpt: "directory memory" }],
          features: ["path-scoping"],
        },
      ],
      featureSupport: { "repo-instructions": "yes", "path-scoping": "yes", imports: "no" },
    };

    writeJson(path.join(beforeFactsDir, "claude-code.json"), beforeFacts);
    writeJson(path.join(factsDir, "claude-code.json"), afterFacts);

    const nowIso = "2025-12-17T12:34:56.000Z";
    const result = await generateAtlasChangelog({
      atlasDir,
      beforeFactsDir,
      now: () => new Date(nowIso),
    });

    expect(result.entries).toHaveLength(1);
    expect(result.writtenPaths.some((p) => p.endsWith("atlas/changelog/2025-12-17-claude-code.json"))).toBe(true);
    expect(result.writtenPaths.some((p) => p.endsWith("atlas/changelog.json"))).toBe(true);

    expect(result.markdownSummary).toContain("2025-12-17-claude-code.json");
    expect(result.markdownSummary).toContain("claude-code.repo-instructions.claude-md");
    expect(result.markdownSummary).toContain("claude-code.path-scoping.directory-memory");

    const entryPath = path.join(atlasDir, "changelog", "2025-12-17-claude-code.json");
    const entry = JSON.parse(fs.readFileSync(entryPath, "utf8")) as AtlasChangelogEntry;
    expect(entry.id).toBe("2025-12-17-claude-code");
    expect(entry.date).toBe(nowIso);
    expect(entry.diffs[0].platformId).toBe("claude-code");
    expect(entry.diffs[0].before).toHaveProperty("claims");
    expect(entry.diffs[0].before).not.toHaveProperty("lastVerified");
    expect(entry.impactedClaims.map((c) => c.claimId).sort()).toEqual([
      "claude-code.path-scoping.directory-memory",
      "claude-code.repo-instructions.claude-md",
    ]);
  });
});
