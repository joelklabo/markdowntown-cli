import { render, screen } from "@testing-library/react";
import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "@/providers/ThemeProvider";

describe("Markdown sanitization", () => {
  it("strips script tags and dangerous attributes", () => {
    const md = '# Title\n\n<script>alert("xss")</script>\n\n<img src="x" onerror="alert(1)" />';
    const { container } = render(
      <ThemeProvider>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {md}
        </ReactMarkdown>
      </ThemeProvider>
    );
    expect(screen.queryByText('alert("xss")')).toBeNull();
    // no script tags or img rendered
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders safe markdown content", () => {
    const md = "# Hello\n\n- one\n- two";
    render(
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {md}
      </ReactMarkdown>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Hello" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(2);
  });
});
