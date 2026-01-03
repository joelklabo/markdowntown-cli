import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimulatorScanMeta } from "@/components/atlas/SimulatorScanMeta";

describe("SimulatorScanMeta", () => {
  it("renders rule metadata when available", () => {
    render(
      <SimulatorScanMeta
        totalFiles={12}
        matchedFiles={3}
        truncated={false}
        rootName="mock-repo"
        tool="github-copilot"
        toolRulesMeta={{
          "github-copilot": {
            docUrl: "https://example.com/docs",
            lastVerified: "2025-12-01T12:00:00Z",
          },
          "copilot-cli": {},
          "codex-cli": {},
          "claude-code": {},
          "gemini-cli": {},
          cursor: {},
        }}
      />,
    );

    expect(screen.getByText(/Rules verified Dec 1, 2025/i)).toBeInTheDocument();
    const docsLink = screen.getByRole("link", { name: "Docs" });
    expect(docsLink).toHaveAttribute("href", "https://example.com/docs");
  });

  it("hides rule metadata when missing", () => {
    render(
      <SimulatorScanMeta
        totalFiles={4}
        matchedFiles={1}
        truncated={false}
        rootName="mock-repo"
        tool="github-copilot"
      />,
    );

    expect(screen.queryByText(/Rules verified/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Docs" })).not.toBeInTheDocument();
  });
});
