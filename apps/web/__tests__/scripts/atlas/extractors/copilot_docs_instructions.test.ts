import { describe, expect, it } from "vitest";
import { copilotDocsInstructionsExtractor } from "../../../../scripts/atlas/extractors/copilot_docs_instructions";

describe("copilotDocsInstructionsExtractor", () => {
  it("extracts repo instructions, scoping, and precedence claims", async () => {
    const html = [
      "<html><body>",
      "<h1>Repository instructions</h1>",
      "<p>Use <code>.github/copilot-instructions.md</code> to provide repo instructions.</p>",
      "<p>Scoped instructions use <code>applyTo</code> frontmatter.</p>",
      "<p>Precedence: more specific rules override general instructions.</p>",
      "</body></html>",
    ].join("");

    const result = await copilotDocsInstructionsExtractor.extract({
      source: {
        id: "github-copilot-repo-instructions",
        platformId: "github-copilot",
        kind: "docs",
        url: "https://example.com/github-copilot/repo-instructions",
        cadence: "monthly",
        expectedPhrases: [".github/copilot-instructions.md"],
        trust: "official",
      },
      html,
    });

    expect(result.featureSupport["repo-instructions"]).toBe("yes");
    expect(result.featureSupport["path-scoping"]).toBe("yes");
    expect(result.featureSupport.imports).toBe("no");

    const ids = result.claims.map((c) => c.id);
    expect(ids).toContain("github-copilot.repo-instructions.file");
    expect(ids).toContain("github-copilot.path-scoping.applyto");
    expect(ids).toContain("github-copilot.path-scoping.precedence");
  });
});
