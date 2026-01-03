import { describe, expect, it } from "vitest";
import { geminiCliDocsExtractor } from "../../../../scripts/atlas/extractors/gemini_cli";

describe("geminiCliDocsExtractor", () => {
  it("extracts GEMINI.md and ignore file claims", async () => {
    const html = [
      "<html><body>",
      "<h1>Gemini CLI</h1>",
      "<p>Create a <code>GEMINI.md</code> file to provide repository instructions.</p>",
      "<p>Use <code>.geminiignore</code> to ignore files.</p>",
      "</body></html>",
    ].join("");

    const result = await geminiCliDocsExtractor.extract({
      source: {
        id: "gemini-cli-gemini-md",
        platformId: "gemini-cli",
        kind: "docs",
        url: "https://example.com/gemini-cli/gemini-md",
        cadence: "monthly",
        expectedPhrases: ["GEMINI.md"],
        trust: "official",
      },
      html,
    });

    expect(result.featureSupport["repo-instructions"]).toBe("yes");
    expect(result.featureSupport["path-scoping"]).toBe("no");
    expect(result.featureSupport.imports).toBe("no");

    const ids = result.claims.map((c) => c.id);
    expect(ids).toContain("gemini-cli.repo-instructions.file");
    expect(ids).toContain("gemini-cli.ignore-file.geminiignore");
  });
});

