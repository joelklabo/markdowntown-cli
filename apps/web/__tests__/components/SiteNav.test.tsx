import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/components/CommandPalette";
import { SiteNav } from "@/components/SiteNav";
import { DensityProvider } from "@/providers/DensityProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

const pushMock = vi.fn();

const createMatchMedia =
  (matchesFor: (query: string) => boolean) =>
  (query: string): MediaQueryList =>
    ({
      matches: matchesFor(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;

const prefersReducedMotion = (query: string) => query.includes("prefers-reduced-motion");

vi.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/library",
}));

describe("SiteNav", () => {
  beforeEach(() => {
    pushMock.mockClear();
    (window.matchMedia as unknown as (query: string) => MediaQueryList) = createMatchMedia(
      (query) => prefersReducedMotion(query) || query.includes("min-width: 768px")
    );
  });

  it("renders the mark downtown wordmark", () => {
    render(
      <ThemeProvider>
        <DensityProvider>
          <SiteNav />
        </DensityProvider>
      </ThemeProvider>
    );
    const wordmark = screen.getByRole("img", { name: "mark downtown" });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark).toHaveClass("mdt-wordmark--banner");
    expect(wordmark).toHaveAttribute("data-render-detail", "hd");
  });

  it("focuses desktop search on / without opening the mobile sheet", () => {
    render(
      <ThemeProvider>
        <DensityProvider>
          <SiteNav />
        </DensityProvider>
      </ThemeProvider>
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));

    expect(screen.queryByRole("dialog", { name: "Search" })).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search library…");
    expect(document.activeElement).toBe(input);
  });

  it("marks the active desktop nav link with aria-current", () => {
    render(
      <ThemeProvider>
        <DensityProvider>
          <SiteNav />
        </DensityProvider>
      </ThemeProvider>
    );

    const [desktopNav] = screen.getAllByRole("navigation", { name: "Primary" });
    const desktopLibrary = within(desktopNav).getByRole("link", { name: "Library" });
    const desktopWorkbench = within(desktopNav).getByRole("link", { name: "Workbench" });
    const desktopTranslate = within(desktopNav).getByRole("link", { name: "Translate" });
    const desktopScan = within(desktopNav).getByRole("link", { name: "Scan" });
    const desktopDocs = within(desktopNav).getByRole("link", { name: "Docs" });
    const desktopLinks = within(desktopNav).getAllByRole("link");

    expect(desktopLibrary).toHaveAttribute("aria-current", "page");
    expect(desktopWorkbench).not.toHaveAttribute("aria-current");
    expect(desktopTranslate).not.toHaveAttribute("aria-current");
    expect(desktopScan).not.toHaveAttribute("aria-current");
    expect(desktopDocs).not.toHaveAttribute("aria-current");
    expect(desktopLinks).toHaveLength(5);
    expect(desktopLibrary.className).toContain("focus-visible:ring-2");
  });

  it("dispatches the command palette open event from the desktop trigger", async () => {
    const handler = vi.fn();
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler as EventListener);

    render(
      <ThemeProvider>
        <DensityProvider>
          <SiteNav />
        </DensityProvider>
      </ThemeProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /command/i }));

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ origin?: string }>;
    expect(event.detail?.origin).toBe("desktop_nav_button");

    window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler as EventListener);
  });

  it("opens and closes the mobile search sheet with focus restore", async () => {
    (window.matchMedia as unknown as (query: string) => MediaQueryList) = createMatchMedia(prefersReducedMotion);

    render(
      <ThemeProvider>
        <DensityProvider>
          <SiteNav />
        </DensityProvider>
      </ThemeProvider>
    );

    const trigger = screen.getByRole("button", { name: "Search", expanded: false });
    await userEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Search" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the overflow sheet and switches to search", async () => {
    (window.matchMedia as unknown as (query: string) => MediaQueryList) = createMatchMedia(prefersReducedMotion);

    render(
      <ThemeProvider>
        <DensityProvider>
          <SiteNav />
        </DensityProvider>
      </ThemeProvider>
    );

    const menuTrigger = screen.getByRole("button", { name: "Open menu" });
    await userEvent.click(menuTrigger);

    const menuDialog = screen.getByRole("dialog", { name: "More" });
    expect(menuDialog).toBeInTheDocument();

    await userEvent.click(within(menuDialog).getByRole("button", { name: "Search" }));

    expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Search" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(menuTrigger);
  });
});
