import { render, screen } from "@testing-library/react";
import { Wordmark } from "@/components/Wordmark";

describe("Wordmark", () => {
  it("renders a link by default", () => {
    render(<Wordmark />);
    expect(screen.getByRole("link", { name: "mark downtown" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "mark downtown" })).toBeInTheDocument();
  });

  it("can render without a link", () => {
    render(<Wordmark asLink={false} />);
    expect(screen.queryByRole("link", { name: "mark downtown" })).not.toBeInTheDocument();
    expect(screen.getByTestId("wordmark")).toHaveAttribute("aria-label", "mark downtown");
    expect(screen.getByRole("img", { name: "mark downtown" })).toBeInTheDocument();
  });

  it("supports size variants", () => {
    render(<Wordmark size="sm" />);
    expect(screen.getByTestId("wordmark")).toHaveClass("text-body-sm");
  });
});
