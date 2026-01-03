import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "@/components/ui/Separator";

describe("Separator", () => {
  it("renders a horizontal separator by default", () => {
    render(<Separator data-testid="sep" />);
    const el = screen.getByTestId("sep");
    expect(el).toHaveAttribute("role", "separator");
    expect(el).toHaveAttribute("aria-orientation", "horizontal");
    expect(el).toHaveClass("h-px");
  });

  it("renders a vertical separator when requested", () => {
    render(<Separator orientation="vertical" data-testid="sep" />);
    const el = screen.getByTestId("sep");
    expect(el).toHaveAttribute("aria-orientation", "vertical");
    expect(el).toHaveClass("w-px");
  });
});

