import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd } from "@/components/ui/Kbd";

describe("Kbd", () => {
  it("renders keyboard text in a kbd element", () => {
    render(<Kbd>⌘K</Kbd>);
    const el = screen.getByText("⌘K");
    expect(el.tagName).toBe("KBD");
  });

  it("accepts custom className", () => {
    render(<Kbd className="test-kbd">Ctrl</Kbd>);
    const el = screen.getByText("Ctrl");
    expect(el).toHaveClass("test-kbd");
  });
});

