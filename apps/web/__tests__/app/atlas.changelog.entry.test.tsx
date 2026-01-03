import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { loadAtlasChangelogEntry, loadAtlasFacts } = vi.hoisted(() => ({
  loadAtlasChangelogEntry: vi.fn(),
  loadAtlasFacts: vi.fn(),
}));

vi.mock("@/lib/atlas/load", () => ({
  loadAtlasChangelogEntry,
  loadAtlasFacts,
}));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound,
}));

import AtlasChangelogEntryPage from "@/app/atlas/changelog/[entryId]/page";

describe("AtlasChangelogEntryPage", () => {
  beforeEach(() => {
    loadAtlasChangelogEntry.mockReset();
    loadAtlasFacts.mockReset();
    notFound.mockReset();
  });

  it("renders summary, impacted claims, and diff rows", async () => {
    loadAtlasChangelogEntry.mockReturnValue({
      id: "entry-1",
      date: "2025-12-17T00:00:00Z",
      summary: "Seed initial facts",
      diffs: [
        {
          platformId: "github-copilot",
          before: { featureSupport: { "repo-instructions": "no" } },
          after: { featureSupport: { "repo-instructions": "yes" } },
        },
      ],
      impactedClaims: [{ platformId: "github-copilot", claimId: "copilot.repo.instructions" }],
    });

    loadAtlasFacts.mockReturnValue({
      name: "GitHub Copilot",
      claims: [
        {
          id: "copilot.repo.instructions",
          statement: "Copilot supports repo instructions.",
          confidence: "high",
          evidence: [{ url: "https://example.com/evidence", title: "Docs" }],
        },
      ],
    });

    const jsx = await AtlasChangelogEntryPage({ params: Promise.resolve({ entryId: "entry-1" }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: /Seed initial facts/i })).toBeInTheDocument();
    expect(screen.getByText("Impacted claims")).toBeInTheDocument();
    expect(screen.getByText(/Copilot supports repo instructions/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "https://example.com/evidence");

    expect(screen.getByText("Facts diff")).toBeInTheDocument();
    expect(screen.getByText('featureSupport["repo-instructions"]')).toBeInTheDocument();
  });

  it("calls notFound when entry is missing", async () => {
    loadAtlasChangelogEntry.mockReturnValue(null);
    await AtlasChangelogEntryPage({ params: Promise.resolve({ entryId: "missing" }) });
    expect(notFound).toHaveBeenCalled();
  });
});
