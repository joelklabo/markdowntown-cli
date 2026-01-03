import { render } from "@testing-library/react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

vi.mock("next/link", () => {
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    href: string;
  };
  const Link = ({ children, href, ...rest }: LinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  return { __esModule: true, default: Link };
});

describe("Button", () => {
  it("applies variant classes", () => {
    const { getByText } = render(<Button>Primary</Button>);
    const className = getByText("Primary").className;
    expect(className).toContain("bg-[color:var(--mdt-color-primary)]");
    expect(className).toContain("shadow-mdt-sm");
  });

  it("applies token-based size classes", () => {
    const { getByText, rerender } = render(<Button size="xs">Size</Button>);
    expect(getByText("Size").className).toContain("h-mdt-8");

    rerender(<Button size="lg">Size</Button>);
    expect(getByText("Size").className).toContain("h-mdt-12");
  });

  it("supports asChild", () => {
    const { getByText } = render(
      <Button asChild>
        <Link href="/test">Go</Link>
      </Button>
    );
    const el = getByText("Go");
    expect(el.tagName).toBe("A");
    expect(el.getAttribute("href")).toBe("/test");
  });
});
