import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AtlasSearch } from "@/components/atlas/AtlasSearch";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push }),
}));

const searchAtlas = vi.fn((query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (q.includes("cop")) {
    return [
      {
        id: "platform:github-copilot",
        kind: "platform",
        title: "GitHub Copilot",
        subtitle: "github-copilot",
        href: "/atlas/platforms/github-copilot",
      },
      {
        id: "claim:github-copilot:c1",
        kind: "claim",
        title: "Supports agents.md",
        subtitle: "github-copilot · c1",
        href: "/atlas/platforms/github-copilot#claims",
      },
    ];
  }
  if (q.includes("agents")) {
    return [
      {
        id: "path:github-copilot:agents",
        kind: "path",
        title: "agents.md",
        subtitle: "github-copilot · Instructions",
        href: "/atlas/platforms/github-copilot#artifacts",
      },
    ];
  }
  if (q.includes("prompt")) {
    return [
      {
        id: "guide:recipes:writing-prompts",
        kind: "recipe",
        title: "Writing prompts",
        subtitle: "recipes",
        href: "/atlas/recipes/writing-prompts",
      },
    ];
  }
  return [];
});

vi.mock("@/lib/atlas/searchIndex", () => ({
  __esModule: true,
  searchAtlas: (query: string) => searchAtlas(query),
}));

describe("AtlasSearch", () => {
  beforeEach(() => {
    push.mockReset();
    searchAtlas.mockClear();
  });

  it("shows an intentional empty state", async () => {
    const user = userEvent.setup();
    render(<AtlasSearch />);

    const input = screen.getByRole("searchbox", { name: /search atlas/i });
    await user.click(input);

    expect(screen.getByText("Start typing to search Atlas.")).toBeInTheDocument();
  });

  it("filters results as the user types and navigates on select", async () => {
    const user = userEvent.setup();
    render(<AtlasSearch />);

    const input = screen.getByRole("searchbox", { name: /search atlas/i });
    await user.click(input);
    await user.type(input, "cop");

    const listbox = screen.getByRole("listbox", { name: /atlas search results/i });
    expect(listbox).toBeInTheDocument();
    expect(within(listbox).getAllByRole("option").length).toBeGreaterThan(0);

    expect(screen.getByText("GitHub Copilot")).toBeInTheDocument();
    expect(screen.getByText("Supports agents.md")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();

    const itemButton = screen.getByText("GitHub Copilot").closest("button");
    expect(itemButton).not.toBeNull();
    await user.click(itemButton!);

    expect(push).toHaveBeenCalledWith("/atlas/platforms/github-copilot");
  });

  it("shows a no-results state", async () => {
    const user = userEvent.setup();
    render(<AtlasSearch />);

    const input = screen.getByRole("searchbox", { name: /search atlas/i });
    await user.click(input);
    await user.type(input, "zzzz");

    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
