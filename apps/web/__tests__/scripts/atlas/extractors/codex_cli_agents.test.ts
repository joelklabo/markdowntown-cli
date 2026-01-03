import { describe, expect, it } from "vitest";
import { codexCliAgentsExtractor } from "../../../../scripts/atlas/extractors/codex_cli_agents";

describe("codexCliAgentsExtractor", () => {
  it("extracts AGENTS.md hierarchy and override claims", async () => {
    const html = [
      "<html><body>",
      "<h1>AGENTS.md</h1>",
      "<p>Place an <code>AGENTS.md</code> file in the repo to configure Codex CLI.</p>",
      "<p>You can add additional <code>AGENTS.md</code> files in subdirectories for scoped rules.</p>",
      "<p>Use <code>AGENTS.override.md</code> to override instructions.</p>",
      "</body></html>",
    ].join("");

    const result = await codexCliAgentsExtractor.extract({
      source: {
        id: "codex-cli-agents-md",
        platformId: "codex-cli",
        kind: "docs",
        url: "https://example.com/codex-cli/agents-md",
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
    expect(ids).toContain("codex-cli.repo-instructions.file");
    expect(ids).toContain("codex-cli.path-scoping.hierarchy");
    expect(ids).toContain("codex-cli.path-scoping.override-file");
  });
});

