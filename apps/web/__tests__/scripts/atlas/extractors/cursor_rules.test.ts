import { describe, expect, it } from "vitest";
import { cursorRulesDocsExtractor } from "../../../../scripts/atlas/extractors/cursor_rules";

describe("cursorRulesDocsExtractor", () => {
  it("extracts .cursor/rules, globs, alwaysApply, and precedence claims", async () => {
    const html = [
      "<html><body>",
      "<h1>Cursor Rules</h1>",
      "<p>Create <code>.cursor/rules/*.mdc</code> files for project rules.</p>",
      "<p>Rules support YAML frontmatter such as <code>globs</code> and <code>alwaysApply</code>.</p>",
      "<p>When multiple rules match, the most specific rule takes precedence.</p>",
      "</body></html>",
    ].join("");

    const result = await cursorRulesDocsExtractor.extract({
      source: {
        id: "cursor-cursorrules",
        platformId: "cursor",
        kind: "docs",
        url: "https://example.com/cursor/cursorrules",
        cadence: "monthly",
        expectedPhrases: [".cursorrules"],
        trust: "official",
      },
      html,
    });

    expect(result.featureSupport["repo-instructions"]).toBe("yes");
    expect(result.featureSupport["path-scoping"]).toBe("yes");
    expect(result.featureSupport.imports).toBe("no");

    const ids = result.claims.map((c) => c.id);
    expect(ids).toContain("cursor.repo-instructions.rules-files");
    expect(ids).toContain("cursor.path-scoping.globs");
    expect(ids).toContain("cursor.path-scoping.alwaysapply");
    expect(ids).toContain("cursor.path-scoping.precedence");
  });
});

