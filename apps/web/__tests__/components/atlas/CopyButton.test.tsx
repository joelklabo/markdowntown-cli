import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CopyButton } from "@/components/atlas/CopyButton";

const writeText = vi.fn();

describe("CopyButton", () => {
  beforeAll(() => {
    (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = { writeText };
  });

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockReturnValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies provided text and shows transient success state", async () => {
    render(<CopyButton text="hello" label="Copy text" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy text" }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByRole("button", { name: "Copy text" })).toBeInTheDocument();
  });
});
