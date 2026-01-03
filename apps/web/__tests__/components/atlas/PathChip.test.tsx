import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { PathChip } from "@/components/atlas/PathChip";

const writeText = vi.fn();

describe("PathChip", () => {
  beforeAll(() => {
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
  });

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockReturnValue(undefined);
  });

  it("renders a monospace chip and copies the path on click", async () => {
    render(<PathChip path=".cursor/rules/*.mdc" />);

    const button = screen.getByRole("button", { name: "Copy .cursor/rules/*.mdc" });
    expect(button.className).toContain("font-mono");

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(".cursor/rules/*.mdc");
  });
});
