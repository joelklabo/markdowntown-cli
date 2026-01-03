import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BuilderClient } from "@/components/BuilderClient";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("Builder page", () => {
  beforeEach(() => {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rendered: "# Sample", hasPrivateContent: false }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders header actions and status summary", () => {
    render(
      <BuilderClient
        templates={[
          { id: "tpl-1", title: "Starter", description: "Starter template", body: "# Title", tags: ["base"] },
        ]}
        snippets={[{ id: "snip-1", title: "Snippet", content: "Do X", tags: ["core"] }]}
      />
    );

    expect(screen.getByText("Assemble your agents.md")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse library" })).toBeInTheDocument();
    expect(screen.getByText("Bundle within budget")).toBeInTheDocument();
    expect(screen.getByText("live perf · cache intent · save state")).toBeInTheDocument();
  });
});
