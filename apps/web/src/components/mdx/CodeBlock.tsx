import React from "react";
import { cn } from "@/lib/cn";

type CodeBlockProps = React.HTMLAttributes<HTMLPreElement> & {
  children?: React.ReactNode;
};

export function CodeBlock({ className, children, ...props }: CodeBlockProps) {
  return (
    <pre
      data-mdx-code-block
      className={cn(
        "mdx-code-block overflow-x-auto rounded-mdt-lg border border-mdt-border/80 bg-mdt-surface px-mdt-4 py-mdt-3 font-mono text-body-xs leading-relaxed text-mdt-text shadow-mdt-sm",
        className
      )}
      {...props}
    >
      {children}
    </pre>
  );
}
