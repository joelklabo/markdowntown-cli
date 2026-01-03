import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/ThemeToggle";

const toggleMock = vi.fn();
let mockTheme: "light" | "dark" = "light";

vi.mock("@/providers/ThemeProvider", () => ({
  __esModule: true,
  useTheme: () => ({ theme: mockTheme, toggle: toggleMock, setTheme: vi.fn() }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "light";
    toggleMock.mockClear();
  });

  it("shows light state and toggles on click", async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch to dark mode/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(toggleMock).toHaveBeenCalledTimes(1);
  });

  it("shows dark state after mount", async () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button", { name: /switch to light mode/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});
