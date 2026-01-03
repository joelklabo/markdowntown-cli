import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { listPublicItems, listTopTags } = vi.hoisted(() => ({
  listPublicItems: vi.fn(),
  listTopTags: vi.fn(),
}));

vi.mock("@/lib/publicItems", () => ({
  listPublicItems,
}));

vi.mock("@/lib/publicTags", () => ({
  listTopTags,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import LibraryPage from "@/app/library/page";

describe("LibraryPage", () => {
  beforeEach(() => {
    listTopTags.mockReset();
    listPublicItems.mockReset();

    listTopTags.mockResolvedValue([{ tag: "ai", count: 12 }]);
    listPublicItems.mockResolvedValue([
      {
        id: "1",
        slug: "test-agent",
        title: "Test Agent",
        description: "Desc",
        type: "agent",
        tags: ["ai"],
        targets: ["agents-md"],
        hasScopes: true,
        lintGrade: null,
        scopeCount: 1,
        blockCount: 1,
        stats: { views: 10, copies: 1, votes: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  it("renders filters and artifact rows", async () => {
    const jsx = await LibraryPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText("Public library")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Advanced filters")).toBeInTheDocument();
    expect(screen.getByText("Public artifacts")).toBeInTheDocument();
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
    expect(screen.getByText("Open in Workbench")).toBeInTheDocument();
  });

  it("parses query params into listPublicItems filters", async () => {
    await LibraryPage({
      searchParams: Promise.resolve({
        q: "rules",
        type: "agent",
        tag: ["ai", "cli"],
        target: "agents-md",
        hasScopes: "1",
      }),
    });

    expect(listPublicItems).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "rules",
        type: "agent",
        tags: ["ai", "cli"],
        targets: ["agents-md"],
        hasScopes: true,
      })
    );
  });
});
