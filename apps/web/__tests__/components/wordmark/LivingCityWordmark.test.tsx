import { render, screen } from "@testing-library/react";
import { LivingCityWordmark } from "@/components/wordmark/LivingCityWordmark";

describe("LivingCityWordmark", () => {
  it("renders an accessible SVG wordmark", () => {
    render(<LivingCityWordmark />);
    expect(screen.getByRole("img", { name: "mark downtown" })).toBeInTheDocument();
  });
});

