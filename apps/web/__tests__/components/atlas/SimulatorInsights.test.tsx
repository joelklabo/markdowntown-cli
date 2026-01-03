import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimulatorInsights } from "@/components/atlas/SimulatorInsights";
import type { SimulatorInsights as SimulatorInsightsData } from "@/lib/atlas/simulators/types";

describe("SimulatorInsights summary", () => {
  it("renders summary counts and next steps when files are missing", () => {
    const insights: SimulatorInsightsData = {
      tool: "github-copilot",
      expectedPatterns: [
        {
          id: "copilot-root",
          label: "Repo instructions",
          pattern: ".github/copilot-instructions.md",
        },
        {
          id: "copilot-scoped",
          label: "Scoped instructions",
          pattern: ".github/instructions/*.instructions.md",
        },
      ],
      foundFiles: [".github/copilot-instructions.md"],
      missingFiles: [
        {
          id: "copilot-scoped",
          label: "Scoped instructions",
          pattern: ".github/instructions/*.instructions.md",
        },
      ],
      precedenceNotes: [],
    };

    render(
      <SimulatorInsights
        insights={insights}
        shadowedFiles={[{ path: "AGENTS.md", reason: "Used by Codex CLI." }]}
      />,
    );

    expect(screen.getByText(/Detected tool: GitHub Copilot/i)).toBeInTheDocument();
    expect(screen.getByText(/Found 1 instruction file/i)).toBeInTheDocument();
    expect(screen.getByText(/1 expected file missing/i)).toBeInTheDocument();
    expect(screen.getByText(/1 shadowed instruction file won't load for this tool/i)).toBeInTheDocument();
    expect(screen.getByText(/Next step: add the missing instruction file/i)).toBeInTheDocument();
  });

  it("renders an empty-state summary when nothing is found", () => {
    const insights: SimulatorInsightsData = {
      tool: "codex-cli",
      expectedPatterns: [
        {
          id: "codex-root",
          label: "Repo instructions",
          pattern: "AGENTS.md",
        },
      ],
      foundFiles: [],
      missingFiles: [
        {
          id: "codex-root",
          label: "Repo instructions",
          pattern: "AGENTS.md",
        },
      ],
      precedenceNotes: [],
    };

    render(<SimulatorInsights insights={insights} shadowedFiles={[]} />);

    expect(screen.getByText(/Detected tool: Codex CLI/i)).toBeInTheDocument();
    expect(screen.getByText(/No instruction files found/i)).toBeInTheDocument();
    expect(screen.getByText(/1 expected file missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Next step: add the missing instruction file/i)).toBeInTheDocument();
    expect(screen.getByText(/scan was truncated due to file limits/i)).toBeInTheDocument();
  });

  it("renders expected patterns and precedence notes lists", () => {
    const insights: SimulatorInsightsData = {
      tool: "codex-cli",
      expectedPatterns: [
        { id: "codex-root", label: "Root instructions", pattern: "AGENTS.md" },
        { id: "codex-override", label: "Root override", pattern: "AGENTS.override.md" },
      ],
      foundFiles: ["AGENTS.md"],
      missingFiles: [],
      precedenceNotes: ["Overrides win in the same folder.", "Deeper paths take precedence."],
    };

    render(<SimulatorInsights insights={insights} shadowedFiles={[]} />);

    const expectedList = screen.getByRole("list", { name: "Expected patterns" });
    expect(expectedList.querySelectorAll("li")).toHaveLength(2);

    const notesList = screen.getByRole("list", { name: "Precedence notes" });
    expect(notesList.querySelectorAll("li")).toHaveLength(2);
  });
});
