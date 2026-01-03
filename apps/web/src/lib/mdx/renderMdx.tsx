import React from "react";
import { evaluate } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { MDX_ALLOWED_COMPONENTS, MDX_COMPONENTS } from "@/lib/mdx/mdxComponents";

type MdastNode = {
  type?: unknown;
  name?: unknown;
  children?: unknown;
};

function assertAllowedMdxTree(tree: unknown): void {
  const stack: unknown[] = [tree];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    const asNode = node as MdastNode;
    const nodeType = typeof asNode.type === "string" ? asNode.type : null;

    if (nodeType === "mdxjsEsm" || nodeType === "mdxFlowExpression" || nodeType === "mdxTextExpression") {
      throw new Error(`[mdx] Disallowed MDX syntax: ${nodeType}`);
    }

    if (nodeType === "mdxJsxFlowElement" || nodeType === "mdxJsxTextElement") {
      const name = typeof asNode.name === "string" ? asNode.name : null;
      if (!name || !MDX_ALLOWED_COMPONENTS.has(name)) {
        throw new Error(`[mdx] Disallowed component: <${name ?? "unknown"}>`);
      }
    }

    const children = asNode.children;
    if (Array.isArray(children)) {
      for (const child of children) stack.push(child);
    }
  }
}

function remarkValidateMdx() {
  return (tree: unknown) => {
    assertAllowedMdxTree(tree);
  };
}

export async function renderMdx(source: string): Promise<React.ReactElement> {
  const runtime = await import("react/jsx-runtime");

  const compiled = await evaluate(source, {
    Fragment: runtime.Fragment,
    jsx: runtime.jsx,
    jsxs: runtime.jsxs,
    remarkPlugins: [remarkGfm, remarkValidateMdx],
  });

  const Content = compiled.default;
  return <Content components={MDX_COMPONENTS} />;
}
