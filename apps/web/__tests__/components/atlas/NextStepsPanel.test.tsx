import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NextStepsPanel } from "@/components/atlas/NextStepsPanel";
import type { NextStep } from "@/lib/atlas/simulators/types";

describe("NextStepsPanel", () => {
  it("renders ready steps with actions", async () => {
    const onAction = vi.fn();
    const steps: NextStep[] = [
      {
        id: "ready",
        severity: "ready",
        title: "You're ready to go",
        body: "All required files are in place.",
        primaryAction: { id: "copy-summary", label: "Copy summary" },
        secondaryActions: [{ id: "download-report", label: "Download report" }],
      },
    ];

    render(<NextStepsPanel steps={steps} onAction={onAction} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    const copyButton = screen.getByRole("button", { name: "Copy summary" });
    await userEvent.click(copyButton);

    expect(onAction).toHaveBeenCalledWith(steps[0].primaryAction, steps[0]);
  });

  it("renders error steps without actions", () => {
    const steps: NextStep[] = [
      {
        id: "missing-root",
        severity: "error",
        title: "Add the root instruction file",
        body: "This tool needs a root file to load instructions.",
      },
    ];

    render(<NextStepsPanel steps={steps} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Add the root instruction file")).toBeInTheDocument();
  });

  it("orders steps by severity and highlights the primary CTA", async () => {
    const onAction = vi.fn();
    const steps: NextStep[] = [
      {
        id: "info-step",
        severity: "info",
        title: "Review expected patterns",
        body: "Check the patterns we scan.",
        primaryAction: { id: "open-docs", label: "Open docs" },
      },
      {
        id: "error-step",
        severity: "error",
        title: "Fix critical issue",
        body: "Missing root instructions.",
        primaryAction: { id: "copy-template", label: "Copy template" },
        secondaryActions: [{ id: "open-docs", label: "Open docs" }],
      },
      {
        id: "warning-step",
        severity: "warning",
        title: "Set cwd",
        body: "Ancestor scans depend on cwd.",
        primaryAction: { id: "set-cwd", label: "Set cwd" },
      },
    ];

    const { container } = render(<NextStepsPanel steps={steps} onAction={onAction} />);

    const titles = Array.from(container.querySelectorAll("p.font-semibold")).map((node) => node.textContent);
    expect(titles).toEqual([
      "Fix critical issue",
      "Set cwd",
      "Review expected patterns",
    ]);

    expect(screen.getByText("Start here")).toBeInTheDocument();

    const openDocsButtons = screen.getAllByRole("button", { name: "Open docs" });
    await userEvent.click(openDocsButtons[0]);
    expect(onAction).toHaveBeenCalledWith(steps[1].secondaryActions?.[0], steps[1]);
  });

  it("prioritizes ready when there are no blocking steps", () => {
    const steps: NextStep[] = [
      {
        id: "info-step",
        severity: "info",
        title: "Review expected patterns",
        body: "Check the patterns we scan.",
        primaryAction: { id: "open-docs", label: "Open docs" },
      },
      {
        id: "ready",
        severity: "ready",
        title: "You're ready to go",
        body: "All required files are in place.",
        primaryAction: { id: "open-workbench", label: "Open Workbench" },
      },
    ];

    const { container } = render(<NextStepsPanel steps={steps} />);

    const titles = Array.from(container.querySelectorAll("p.font-semibold")).map((node) => node.textContent);
    expect(titles[0]).toBe("You're ready to go");
    expect(screen.getByText("Start here")).toBeInTheDocument();
  });
});
