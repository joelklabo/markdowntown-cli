import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderMdx } from "@/lib/mdx/renderMdx";

describe("renderMdx", () => {
  it("renders basic MDX and styles code fences", async () => {
    const jsx = await renderMdx(`# Hello\n\nSome text.\n\n\`\`\`ts\nconst x = 1\n\`\`\`\n`);
    render(jsx);

    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument();
    expect(screen.getByText("Some text.")).toBeInTheDocument();

    const code = screen.getByText("const x = 1");
    const pre = code.closest("pre");
    expect(pre).toBeTruthy();
    expect(pre).toHaveAttribute("data-mdx-code-block");
  });

  it("rejects disallowed components", async () => {
    await expect(renderMdx("# Hi\n\n<NotAllowed />\n")).rejects.toThrow(/Disallowed component/);
  });
});
