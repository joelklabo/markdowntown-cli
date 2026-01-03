import { render, screen } from "@testing-library/react";
import { WordmarkLegend } from "@/components/wordmark/WordmarkLegend";

describe("WordmarkLegend", () => {
  it("renders event mappings", () => {
    render(<WordmarkLegend defaultOpen />);

    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Command palette")).toBeInTheDocument();
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Alert")).toBeInTheDocument();
  });
});
