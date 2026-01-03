import { render, screen } from "@testing-library/react";
import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";

describe("HomeSectionHeader", () => {
  it("renders eyebrow, title, and description", () => {
    render(
      <HomeSectionHeader
        eyebrow="Scan-first"
        title="Scan your repo"
        description="See what instruction files load."
      />
    );
    expect(screen.getByText("Scan-first")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scan your repo" })).toBeInTheDocument();
    expect(screen.getByText("See what instruction files load.")).toBeInTheDocument();
  });

  it("supports center alignment", () => {
    const { container } = render(
      <HomeSectionHeader
        eyebrow="Scan-first"
        title="Centered"
        description="Centered description"
        align="center"
      />
    );
    expect(container.firstChild).toHaveClass("text-center");
    expect(container.firstChild).toHaveClass("items-center");
  });
});
