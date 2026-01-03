import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LibraryCard } from "@/components/LibraryCard";
import type { SampleItem } from "@/lib/sampleContent";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => {
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode };
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: LinkProps) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  };
});

describe("LibraryCard", () => {
  const item: SampleItem = {
    id: "demo-snippet",
    title: "Snippet demo",
    description: "Test snippet description",
    tags: ["cli", "qa"],
    stats: { copies: 12, views: 34, votes: 5 },
    type: "snippet",
    badge: "trending",
  };

  it("shows metadata and handles quick actions for snippet items", () => {
    const onCopy = vi.fn();
    const onAdd = vi.fn();
    render(<LibraryCard item={item} onCopySnippet={onCopy} onAddToBuilder={onAdd} />);

    expect(screen.getByText("Snippet")).toBeInTheDocument();
    expect(screen.getByText("Trending")).toBeInTheDocument();
    expect(screen.getByText(/Test snippet description/)).toBeInTheDocument();
    expect(screen.getByText("#cli")).toBeInTheDocument();
    expect(screen.getByText("#qa")).toBeInTheDocument();
    expect(screen.getByText("34 views")).toBeInTheDocument();
    expect(screen.getByText("12 copies")).toBeInTheDocument();
    expect(screen.getByText("5 votes")).toBeInTheDocument();

    screen.getByRole("button", { name: /open snippet demo in workbench/i }).click();
    expect(onAdd).toHaveBeenCalledWith(item);
    screen.getByText("More").click();
    screen.getByRole("button", { name: /copy snippet/i }).click();
    expect(onCopy).toHaveBeenCalled();
  });
});
