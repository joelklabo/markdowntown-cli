import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

describe("Breadcrumb", () => {
  it("renders links, current segment, and separators", () => {
    render(
      <Breadcrumb
        segments={[
          { href: "/browse", label: "Browse" },
          { href: "/snippets", label: "Snippets" },
          { label: "Prompt" },
        ]}
      />
    );

    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
    expect(screen.getByText("Prompt")).toBeInTheDocument();
    expect(screen.getAllByText("/")).toHaveLength(2);
  });
});
