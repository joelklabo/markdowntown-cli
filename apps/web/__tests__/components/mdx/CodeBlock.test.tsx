import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeBlock } from "@/components/mdx/CodeBlock";

describe("CodeBlock", () => {
  it("renders a styled pre wrapper for fences", () => {
    render(
      <CodeBlock>
        <code>const x = 1</code>
      </CodeBlock>
    );

    const code = screen.getByText("const x = 1");
    const pre = code.closest("pre");
    expect(pre).toBeTruthy();
    expect(pre).toHaveAttribute("data-mdx-code-block");
  });
});
