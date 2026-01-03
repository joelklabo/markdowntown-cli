import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstructionHealthPanel } from "@/components/atlas/InstructionHealthPanel";
import type { InstructionDiagnostics } from "@/lib/atlas/simulators/types";

describe("InstructionHealthPanel", () => {
  it("shows a pass state when there are no diagnostics", () => {
    const diagnostics: InstructionDiagnostics = { tool: "codex-cli", diagnostics: [] };

    render(<InstructionHealthPanel diagnostics={diagnostics} />);

    expect(screen.getByRole("heading", { name: "Instruction health" })).toBeInTheDocument();
    expect(screen.getByText("Everything looks good")).toBeInTheDocument();
    expect(screen.getByText("No placement issues detected for this tool.")).toBeInTheDocument();
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });

  it("renders issues sorted by severity with actions", () => {
    const diagnostics: InstructionDiagnostics = {
      tool: "codex-cli",
      diagnostics: [
        {
          code: "mixed-tools",
          severity: "warning",
          message: "Instruction files for other tools were detected: Claude Code.",
          suggestion: "Confirm you are validating the correct tool.",
        },
        {
          code: "missing.agents",
          severity: "error",
          message: "No AGENTS.md files found.",
          suggestion: "Add AGENTS.md at the repo root.",
          expectedPath: "AGENTS.md",
        },
      ],
    };

    render(<InstructionHealthPanel diagnostics={diagnostics} copySummaryText="Fix summary" />);

    expect(screen.getByRole("button", { name: "Copy fix summary" })).toBeInTheDocument();

    const issuesList = screen.getByRole("list", { name: "Instruction health issues" });
    const items = within(issuesList).getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("No AGENTS.md files found.");
    expect(items[1]).toHaveTextContent("Instruction files for other tools were detected");
    expect(screen.getByText("Add AGENTS.md at the repo root.")).toBeInTheDocument();
    expect(screen.getByText("Copy template")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Workbench" })).toBeInTheDocument();
    expect(screen.getByText("AGENTS.md")).toBeInTheDocument();
  });
});
