import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { loadAtlasFacts, listAtlasExamples } = vi.hoisted(() => ({
  loadAtlasFacts: vi.fn(),
  listAtlasExamples: vi.fn(),
}));

vi.mock("@/lib/atlas/load", () => ({
  loadAtlasFacts,
  listAtlasExamples,
}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound,
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

import AtlasPlatformPage from "@/app/atlas/platforms/[platformId]/page";

describe("AtlasPlatformPage", () => {
  beforeEach(() => {
    loadAtlasFacts.mockReset();
    listAtlasExamples.mockReset();
    notFound.mockReset();
  });

  it("renders core sections for a platform", async () => {
    loadAtlasFacts.mockReturnValue({
      schemaVersion: 1,
      platformId: "github-copilot",
      name: "GitHub Copilot",
      docHome: "https://example.com/copilot",
      retrievedAt: "2025-12-17T00:00:00Z",
      lastVerified: "2025-12-17T00:00:00Z",
      artifacts: [
        {
          kind: "repo-instructions",
          label: "Repo instructions",
          description: "Where repository-level instructions live.",
          paths: [".github/copilot-instructions.md"],
          docs: "https://example.com/docs/repo-instructions",
        },
      ],
      claims: [
        {
          id: "copilot.repo.instructions",
          statement: "Copilot supports repo instructions.",
          confidence: "high",
          evidence: [{ url: "https://example.com/evidence", title: "Evidence" }],
          features: ["repo-instructions"],
        },
      ],
      featureSupport: {
        "repo-instructions": "yes",
        "path-scoping": "partial",
        imports: "no",
      },
    });

    listAtlasExamples.mockReturnValue([{ fileName: "example.md", contents: "# Hello" }]);

    const jsx = await AtlasPlatformPage({ params: Promise.resolve({ platformId: "github-copilot" }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "GitHub Copilot" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Translate" })).toHaveAttribute(
      "href",
      expect.stringContaining("/translate?target=github-copilot")
    );
    expect(screen.getByRole("link", { name: "Open baseline template in Workbench" })).toHaveAttribute(
      "href",
      expect.stringContaining("/workbench?templateId=")
    );

    expect(screen.getAllByRole("button", { name: "Download example zip" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Spec")).toBeInTheDocument();
    expect(screen.getByText("Artifacts")).toBeInTheDocument();
    expect(screen.getByText(".github/copilot-instructions.md")).toBeInTheDocument();
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByText(/Copilot supports repo instructions/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Evidence" })).toHaveAttribute("href", "https://example.com/evidence");
    expect(screen.getByText("Examples")).toBeInTheDocument();
    expect(screen.getByText("example.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy example example.md" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Translate" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workbench" })).toBeInTheDocument();
  });

  it("calls notFound for unknown platformId", async () => {
    await AtlasPlatformPage({ params: Promise.resolve({ platformId: "not-a-platform" }) });
    expect(notFound).toHaveBeenCalled();
  });
});
