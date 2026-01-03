import { render } from "@testing-library/react";
import { IconButton } from "@/components/ui/IconButton";

describe("IconButton", () => {
  it("applies variant classes", () => {
    const { getByRole } = render(
      <IconButton variant="primary" aria-label="Primary icon button">
        ✦
      </IconButton>
    );

    const className = getByRole("button", { name: /primary icon button/i }).className;
    expect(className).toContain("bg-[color:var(--mdt-color-primary)]");
    expect(className).toContain("shadow-mdt-btn");
  });

  it("applies token-based size classes", () => {
    const { getByRole, rerender } = render(
      <IconButton size="xs" aria-label="Icon button">
        ✦
      </IconButton>
    );

    expect(getByRole("button", { name: /icon button/i }).className).toContain("h-mdt-8");
    expect(getByRole("button", { name: /icon button/i }).className).toContain("w-mdt-8");

    rerender(
      <IconButton size="lg" aria-label="Icon button">
        ✦
      </IconButton>
    );

    expect(getByRole("button", { name: /icon button/i }).className).toContain("h-mdt-12");
    expect(getByRole("button", { name: /icon button/i }).className).toContain("w-mdt-12");
  });

  it("supports asChild", () => {
    const { getByRole } = render(
      <IconButton asChild>
        <a href="/test" aria-label="Go link">
          Go
        </a>
      </IconButton>
    );

    const el = getByRole("link", { name: /go link/i });
    expect(el.tagName).toBe("A");
    expect(el.getAttribute("href")).toBe("/test");
    expect(el.className).toContain("h-mdt-11");
    expect(el.className).toContain("w-mdt-11");
  });
});
