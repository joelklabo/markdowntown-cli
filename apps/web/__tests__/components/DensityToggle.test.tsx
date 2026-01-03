import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DensityToggle } from "@/components/DensityToggle";
import { DensityProvider } from "@/providers/DensityProvider";

describe("DensityToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.density;
    document.cookie = "mdt_density=; path=/; max-age=0";
  });

  it("toggles density and updates the label", async () => {
    render(
      <DensityProvider>
        <DensityToggle />
      </DensityProvider>
    );

    expect(screen.getByText(/density: comfortable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /switch to compact density/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await userEvent.click(screen.getByRole("button", { name: /switch to compact density/i }));

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe("compact");
    });

    expect(screen.getByText(/density: compact/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /switch to comfortable density/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
