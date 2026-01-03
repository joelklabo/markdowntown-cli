import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstructionContentLint } from "@/components/atlas/InstructionContentLint";
import type { ContentLintResult } from "@/lib/atlas/simulators/contentLint";

describe("InstructionContentLint", () => {
  it("prompts users to enable content linting when disabled", () => {
    render(<InstructionContentLint enabled={false} result={null} />);

    expect(screen.getByRole("heading", { name: "Content lint" })).toBeInTheDocument();
    expect(screen.getByText("Enable content linting to see results")).toBeInTheDocument();
  });

  it("shows an empty state when enabled but no content is available", () => {
    const result: ContentLintResult = { issues: [], checkedFiles: 0, skippedFiles: 0 };

    render(<InstructionContentLint enabled={true} result={result} />);

    expect(screen.getByText("No instruction content available")).toBeInTheDocument();
  });

  it("renders summaries and issues when linting finds problems", () => {
    const result: ContentLintResult = {
      checkedFiles: 2,
      skippedFiles: 1,
      issues: [
        {
          code: "missing-front-matter",
          severity: "warning",
          message: "Scoped instructions should include applyTo front matter.",
          suggestion: "Add applyTo: \"**/*\".",
          path: ".github/instructions/api.instructions.md",
        },
      ],
    };

    render(<InstructionContentLint enabled={true} result={result} />);

    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Checked 2 files. Skipped 1 file.")).toBeInTheDocument();

    const issuesList = screen.getByRole("list", { name: "Content lint issues" });
    expect(within(issuesList).getByText(/Scoped instructions should include applyTo front matter/i)).toBeInTheDocument();
    expect(within(issuesList).getByText(".github/instructions/api.instructions.md")).toBeInTheDocument();
    expect(within(issuesList).getByText("Add applyTo: \"**/*\".")).toBeInTheDocument();
  });
});
