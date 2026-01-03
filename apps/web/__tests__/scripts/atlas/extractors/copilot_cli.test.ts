import { describe, expect, it } from "vitest";
import { copilotCliDocsExtractor } from "../../../../scripts/atlas/extractors/copilot_cli";

describe("copilotCliDocsExtractor", () => {
  it("extracts instruction files and custom agent locations", async () => {
    const html = [
      "<html><body>",
      "<h1>Copilot CLI</h1>",
      "<ul>",
      "<li>Repository-wide instructions in <code>.github/copilot-instructions.md</code></li>",
      "<li>Path-specific instructions: <code>.github/copilot-instructions/**/*.instructions.md</code></li>",
      "<li>Agent files such as <code>AGENTS.md</code></li>",
      "</ul>",
      "<p>Copilot CLI supports loading custom agents from <code>~/.copilot/agents</code> and <code>.github/agents</code>.</p>",
      "<p>Organization agents can live in <code>/agents</code> inside an organization <code>.github-private</code> repository.</p>",
      "<p>In the case of naming conflicts, a system-level agent overrides a repository-level agent.</p>",
      "</body></html>",
    ].join("");

    const result = await copilotCliDocsExtractor.extract({
      source: {
        id: "copilot-cli-agents-md",
        platformId: "copilot-cli",
        kind: "docs",
        url: "https://example.com/copilot-cli/agents-md",
        cadence: "monthly",
        expectedPhrases: ["AGENTS.md"],
        trust: "medium",
      },
      html,
    });

    expect(result.featureSupport["repo-instructions"]).toBe("yes");
    expect(result.featureSupport["path-scoping"]).toBe("yes");
    expect(result.featureSupport.imports).toBe("no");

    const ids = result.claims.map((c) => c.id);
    expect(ids).toContain("copilot-cli.repo-instructions.file");
    expect(ids).toContain("copilot-cli.path-scoping.instructions-files");
    expect(ids).toContain("copilot-cli.repo-instructions.agents-file");
    expect(ids).toContain("copilot-cli.custom-agents.user-dir");
    expect(ids).toContain("copilot-cli.custom-agents.repo-dir");
    expect(ids).toContain("copilot-cli.custom-agents.org-dir");
    expect(ids).toContain("copilot-cli.custom-agents.precedence");
  });
});

