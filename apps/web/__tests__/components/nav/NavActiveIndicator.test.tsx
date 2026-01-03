import { render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { NavActiveIndicator } from "@/components/nav/NavActiveIndicator";

function rect(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    top: 0,
    left,
    width,
    height: 0,
    right: left + width,
    bottom: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function TestNav({ active }: { active: "one" | "two" }) {
  const navRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={navRef} data-left="0" data-width="320">
      <a data-nav-active={active === "one" ? "true" : undefined} data-left="12" data-width="72">
        One
      </a>
      <a data-nav-active={active === "two" ? "true" : undefined} data-left="120" data-width="96">
        Two
      </a>
      <NavActiveIndicator containerRef={navRef} activeKey={active} />
    </div>
  );
}

describe("NavActiveIndicator", () => {
  it("measures and updates the indicator transform when the active item changes", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function mockRect(this: HTMLElement) {
      const left = Number(this.dataset.left ?? 0);
      const width = Number(this.dataset.width ?? 0);
      return rect(left, width);
    });

    const { rerender } = render(<TestNav active="one" />);

    const position = document.querySelector(".mdt-nav-active-indicator-position") as HTMLElement | null;
    const bar = document.querySelector(".mdt-nav-active-indicator-bar") as HTMLElement | null;

    expect(position).toBeTruthy();
    expect(bar).toBeTruthy();

    await waitFor(() => {
      expect(position).toHaveStyle({ transform: "translateX(12px)" });
      expect(bar).toHaveStyle({ transform: "scaleX(72)" });
    });

    rerender(<TestNav active="two" />);

    expect(screen.getByText("Two")).toBeInTheDocument();
    await waitFor(() => {
      expect(position).toHaveStyle({ transform: "translateX(120px)" });
      expect(bar).toHaveStyle({ transform: "scaleX(96)" });
    });
  });
});
