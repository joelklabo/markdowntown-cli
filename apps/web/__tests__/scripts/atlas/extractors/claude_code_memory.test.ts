import { describe, expect, it } from "vitest";
import { claudeCodeMemoryExtractor } from "../../../../scripts/atlas/extractors/claude_code_memory";

describe("claudeCodeMemoryExtractor", () => {
  it("extracts project memory and directory scoping claims", async () => {
    const html = [
      "<html><body>",
      "<h1>Project memory</h1>",
      "<p>Create a <code>CLAUDE.md</code> file to store project memory.</p>",
      "<h2>Directory memory</h2>",
      "<p>You can also add <code>CLAUDE.md</code> files in subdirectories for scoped context.</p>",
      "<p>Precedence: more specific memory overrides general memory.</p>",
      "</body></html>",
    ].join("");

    const result = await claudeCodeMemoryExtractor.extract({
      source: {
        id: "claude-code-claude-md",
        platformId: "claude-code",
        kind: "docs",
        url: "https://example.com/claude-code/claude-md",
        cadence: "monthly",
        expectedPhrases: ["CLAUDE.md"],
        trust: "official",
      },
      html,
    });

    expect(result.featureSupport["repo-instructions"]).toBe("yes");
    expect(result.featureSupport["path-scoping"]).toBe("yes");
    expect(result.featureSupport.imports).toBe("no");

    const ids = result.claims.map((c) => c.id);
    expect(ids).toContain("claude-code.repo-instructions.claude-md");
    expect(ids).toContain("claude-code.path-scoping.directory-memory");
    expect(ids).toContain("claude-code.path-scoping.precedence");
  });
});
