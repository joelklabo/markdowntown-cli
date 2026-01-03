import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AtlasSimulatorPage from "@/app/atlas/simulator/page";

describe("/atlas/simulator page", () => {
  it("renders simulator inputs", () => {
    render(<AtlasSimulatorPage />);
    expect(screen.getByRole("heading", { name: "Scan a folder" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scan setup" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument();
    expect(screen.getByLabelText("Upload folder")).toBeInTheDocument();
    expect(screen.getByText(/show advanced settings/i)).toBeInTheDocument();
    screen.getByText(/show advanced settings/i).click();
    expect(screen.getByLabelText("Tool")).toBeInTheDocument();
    expect(screen.getByLabelText("Current directory (cwd)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loaded files" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quick actions" })).toBeInTheDocument();
  });
});
