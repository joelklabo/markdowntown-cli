import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DensityProvider, useDensity } from "@/providers/DensityProvider";

function DensityTester() {
  const { density, toggleDensity } = useDensity();
  return (
    <div>
      <div data-testid="density">{density}</div>
      <button type="button" onClick={toggleDensity}>
        toggle
      </button>
    </div>
  );
}

describe("DensityProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.density;
    document.cookie = "mdt_density=; path=/; max-age=0";
  });

  it("defaults to comfortable", async () => {
    render(
      <DensityProvider>
        <DensityTester />
      </DensityProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe("comfortable");
    });

    expect(screen.getByTestId("density")).toHaveTextContent("comfortable");
  });

  it("reads stored value from localStorage", async () => {
    localStorage.setItem("mdt_density", "compact");

    render(
      <DensityProvider>
        <DensityTester />
      </DensityProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe("compact");
    });

    expect(screen.getByTestId("density")).toHaveTextContent("compact");
  });

  it("toggles density and updates documentElement.dataset", async () => {
    render(
      <DensityProvider>
        <DensityTester />
      </DensityProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe("comfortable");
    });

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe("compact");
    });

    expect(localStorage.getItem("mdt_density")).toBe("compact");
  });

  it("uses the initial density when provided", async () => {
    render(
      <DensityProvider initialDensity="compact">
        <DensityTester />
      </DensityProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe("compact");
    });

    expect(screen.getByTestId("density")).toHaveTextContent("compact");
  });
});
