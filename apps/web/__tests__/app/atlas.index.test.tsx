import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { listAtlasPlatforms, loadAtlasFacts, listAtlasGuideSlugs } = vi.hoisted(() => ({
  listAtlasPlatforms: vi.fn(),
  loadAtlasFacts: vi.fn(),
  listAtlasGuideSlugs: vi.fn(),
}));

vi.mock("@/lib/atlas/load", () => ({
  listAtlasPlatforms,
  loadAtlasFacts,
  listAtlasGuideSlugs,
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

import AtlasHomePage from "@/app/atlas/page";
import AtlasPlatformsPage from "@/app/atlas/platforms/page";
import AtlasConceptsPage from "@/app/atlas/concepts/page";
import AtlasRecipesPage from "@/app/atlas/recipes/page";

describe("Atlas index pages", () => {
  beforeEach(() => {
    listAtlasPlatforms.mockReset();
    loadAtlasFacts.mockReset();
    listAtlasGuideSlugs.mockReset();

    listAtlasPlatforms.mockReturnValue(["github-copilot"]);
    loadAtlasFacts.mockReturnValue({
      name: "GitHub Copilot",
      lastVerified: "2025-12-17T00:00:00Z",
      featureSupport: {
        "repo-instructions": "yes",
        "path-scoping": "partial",
        imports: "no",
      },
    });

    listAtlasGuideSlugs.mockImplementation((kind: string) => {
      if (kind === "concepts") return ["precedence"];
      if (kind === "recipes") return ["safe-shell-commands"];
      return [];
    });
  });

  it("renders /atlas home links", () => {
    render(<AtlasHomePage />);
    expect(screen.getByRole("link", { name: /Platforms/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Concepts/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Recipes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Simulator/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compare/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Changelog/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });

  it("renders platforms, concepts, and recipes indexes", () => {
    render(<AtlasPlatformsPage />);
    expect(screen.getByRole("heading", { name: "Platforms" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GitHub Copilot/i })).toHaveAttribute(
      "href",
      "/atlas/platforms/github-copilot"
    );

    render(<AtlasConceptsPage />);
    expect(screen.getByRole("heading", { name: "Concepts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Precedence/i })).toHaveAttribute("href", "/atlas/concepts/precedence");

    render(<AtlasRecipesPage />);
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Safe Shell Commands/i })).toHaveAttribute(
      "href",
      "/atlas/recipes/safe-shell-commands"
    );
  });
});
