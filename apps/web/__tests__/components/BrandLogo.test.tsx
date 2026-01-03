import { render, screen } from "@testing-library/react";
import { BrandLogo } from "@/components/BrandLogo";

describe("BrandLogo", () => {
  it("renders wordmark by default", () => {
    render(<BrandLogo />);
    expect(screen.getByRole("img", { name: /mark downtown logo/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^mark downtown$/i })).toBeInTheDocument();
    const img = screen.getByRole("img", { name: /mark downtown logo/i });
    expect(img).toHaveAttribute("src");
  });

  it("can hide the wordmark", () => {
    render(<BrandLogo showWordmark={false} />);
    expect(screen.queryByRole("img", { name: /^mark downtown$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /mark downtown logo/i })).toBeInTheDocument();
  });
});
