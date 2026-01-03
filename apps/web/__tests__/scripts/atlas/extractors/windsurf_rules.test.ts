import { describe, expect, it } from "vitest";
import { windsurfRulesDocsExtractor } from "../../../../scripts/atlas/extractors/windsurf_rules";

describe("windsurfRulesDocsExtractor", () => {
  it("extracts AGENTS.md scoping and .codeiumignore claims", async () => {
    const html = [
      "<html><body>",
      "<h1>AGENTS.md</h1>",
      "<p>Provide directory-scoped instructions to Cascade using <code>AGENTS.md</code> files.</p>",
      "<p>Root directory instructions apply globally. Subdirectories apply to files in that directory and its subdirectories.</p>",
      "<p>Add a <code>.codeiumignore</code> file to configure what Windsurf Indexing ignores.</p>",
      "</body></html>",
    ].join("");

    const result = await windsurfRulesDocsExtractor.extract({
      source: {
        id: "windsurf-windsurfrules",
        platformId: "windsurf",
        kind: "docs",
        url: "https://example.com/windsurf/windsurfrules",
        cadence: "monthly",
        expectedPhrases: [".windsurfrules"],
        trust: "official",
      },
      html,
    });

    expect(result.featureSupport["repo-instructions"]).toBe("yes");
    expect(result.featureSupport["path-scoping"]).toBe("yes");
    expect(result.featureSupport.imports).toBe("no");

    const ids = result.claims.map((c) => c.id);
    expect(ids).toContain("windsurf.repo-instructions.file");
    expect(ids).toContain("windsurf.path-scoping.hierarchy");
    expect(ids).toContain("windsurf.ignore-file.codeiumignore");
  });
});

