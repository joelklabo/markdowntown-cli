import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { listAtlasPlatforms, loadAtlasFacts, loadAtlasCrosswalk } = vi.hoisted(() => ({
  listAtlasPlatforms: vi.fn(),
  loadAtlasFacts: vi.fn(),
  loadAtlasCrosswalk: vi.fn(),
}));

vi.mock("@/lib/atlas/load", () => ({
  listAtlasPlatforms,
  loadAtlasFacts,
  loadAtlasCrosswalk,
}));

vi.mock("next/link", () => {
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  };
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: LinkProps) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  };
});

import AtlasComparePage from "@/app/atlas/compare/page";

describe("AtlasComparePage", () => {
  beforeEach(() => {
    listAtlasPlatforms.mockReset();
    loadAtlasFacts.mockReset();
    loadAtlasCrosswalk.mockReset();

    listAtlasPlatforms.mockReturnValue(["cursor", "github-copilot", "claude-code"]);

    loadAtlasFacts.mockImplementation((platformId: string) => {
      const base = {
        schemaVersion: 1,
        platformId,
        name: platformId,
        retrievedAt: "2025-12-17T00:00:00Z",
        lastVerified: "2025-12-17T00:00:00Z",
        artifacts: [],
        claims: [],
        featureSupport: {
          "repo-instructions": "no",
          "path-scoping": "no",
          imports: "no",
        },
      };

      if (platformId === "cursor") {
        return {
          ...base,
          name: "Cursor",
          claims: [
            {
              id: "cursor.repo.instructions",
              statement: "Cursor supports repo instructions via .cursorrules.",
              confidence: "high",
              evidence: [{ url: "https://example.com/cursor", title: "Cursor docs" }],
              features: ["repo-instructions"],
            },
          ],
          featureSupport: { ...base.featureSupport, "repo-instructions": "yes", "path-scoping": "partial" },
        };
      }

      if (platformId === "github-copilot") {
        return {
          ...base,
          name: "GitHub Copilot",
          featureSupport: { ...base.featureSupport, "repo-instructions": "yes" },
        };
      }

      return { ...base, name: "Claude Code", featureSupport: { ...base.featureSupport, "repo-instructions": "partial" } };
    });

    loadAtlasCrosswalk.mockReturnValue({
      schemaVersion: 1,
      crosswalk: {
        "repo-instructions": {
          cursor: [".cursorrules"],
          "github-copilot": [".github/copilot-instructions.md"],
        },
        "path-scoping": {
          cursor: [".cursorrules"],
          "github-copilot": [".github/copilot-instructions.md"],
        },
        imports: {
          cursor: [".cursorrules"],
          "github-copilot": [".github/copilot-instructions.md"],
        },
      },
    });
  });

  it("renders matrix, supports selection, and drills into claims", async () => {
    const user = userEvent.setup();
    const jsx = await AtlasComparePage();
    render(jsx);

    expect(screen.getByRole("heading", { name: "Compare" })).toBeInTheDocument();

    // Initial selection includes first two platforms.
    expect(screen.getByRole("checkbox", { name: "Select cursor" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select github-copilot" })).toBeChecked();

    // Select a third platform.
    await user.click(screen.getByRole("checkbox", { name: "Select claude-code" }));
    expect(screen.getByRole("checkbox", { name: "Select claude-code" })).toBeChecked();

    // Drilldown from a cell shows claims + evidence.
    await user.click(screen.getByRole("button", { name: "Show details for repo-instructions on cursor" }));
    expect(screen.getByText(/Cursor supports repo instructions/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cursor docs" })).toHaveAttribute("href", "https://example.com/cursor");

    // Crosswalk section shows equivalent artifacts.
    expect(screen.getByText("Equivalent artifacts")).toBeInTheDocument();
    expect(screen.getAllByText(".cursorrules").length).toBeGreaterThan(0);
    expect(screen.getAllByText(".github/copilot-instructions.md").length).toBeGreaterThan(0);
  });
});
