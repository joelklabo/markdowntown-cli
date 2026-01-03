import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandPalette, COMMAND_PALETTE_OPEN_EVENT } from "@/components/CommandPalette";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import { track } from "@/lib/analytics";
import { searchAtlasPaletteHits } from "@/lib/atlas/searchIndex";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/workbench",
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/atlas/searchIndex", () => ({
  searchAtlasPaletteHits: vi.fn(),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    act(() => {
      useWorkbenchStore.getState().resetDraft();
    });
  });

  it("renders without crashing", () => {
    render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );
  });

  it("opens with Ctrl+K", () => {
    render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByPlaceholderText("Type a command or search…")).toBeInTheDocument();
    expect(document.querySelector(".mdt-radix-overlay")).not.toBeNull();
    expect(document.querySelector(".mdt-radix-panel-scale")).not.toBeNull();
    expect(track).toHaveBeenCalled();
  });

  it("includes key commands when opened", () => {
    render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT, { detail: { origin: "test" } }));
    });

    expect(screen.getByText("Open workbench")).toBeInTheDocument();
    expect(screen.getByText("Translate (paste)")).toBeInTheDocument();
    expect(screen.getByText("Create new artifact")).toBeInTheDocument();
    expect(screen.getByText("Export zip")).toBeInTheDocument();
    expect(screen.getByText("⌘B").closest("kbd")).not.toBeNull();
  });

  it("opens block picker query with Ctrl+P", () => {
    act(() => {
      const store = useWorkbenchStore.getState();
      store.setUam({
        ...store.uam,
        blocks: [{ id: "b1", scopeId: "global", kind: "markdown", body: "Hello" }],
      });
    });

    render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );

    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const input = screen.getByPlaceholderText("Type a command or search…");
    expect(input).toHaveValue("open block");
    expect(screen.getByText(/Open block:/)).toBeInTheDocument();
  });

  it("marks the draft as saved with Ctrl+S on Workbench", () => {
    render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );

    expect(useWorkbenchStore.getState().autosaveStatus).toBe("idle");
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(useWorkbenchStore.getState().autosaveStatus).toBe("saved");
    expect(useWorkbenchStore.getState().lastSavedAt).not.toBeNull();
    expect(track).toHaveBeenCalledWith("workbench_shortcut", expect.objectContaining({ action: "save_draft" }));
  });

  it("opens export query with Ctrl+Shift+E", () => {
    render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );

    fireEvent.keyDown(window, { key: "e", ctrlKey: true, shiftKey: true });
    const input = screen.getByPlaceholderText("Type a command or search…");
    expect(input).toHaveValue("export");
  });

  it("supports Atlas search mode and navigates to hits", async () => {
    const user = userEvent.setup();

    const searchMock = vi.mocked(searchAtlasPaletteHits);
    searchMock.mockImplementation((value: string) => {
      if (!value.toLowerCase().includes("cop")) return [];
      return [
        {
          id: "platform:github-copilot",
          label: "GitHub Copilot",
          hint: "Platform",
          href: "/atlas/platforms/github-copilot",
        },
      ];
    });

    render(
      <ThemeProvider>
        <CommandPalette />
      </ThemeProvider>
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT, { detail: { origin: "test" } }));
    });

    fireEvent.click(screen.getByText("Search Atlas…"));
    const input = screen.getByPlaceholderText("Type a command or search…");
    expect(input).toHaveValue("atlas ");

    await user.type(input, "cop");
    expect(searchAtlasPaletteHits).toHaveBeenLastCalledWith("cop");
    expect(screen.getByText("GitHub Copilot")).toBeInTheDocument();

    fireEvent.click(screen.getByText("GitHub Copilot"));
    expect(push).toHaveBeenCalledWith("/atlas/platforms/github-copilot");
  });
});
