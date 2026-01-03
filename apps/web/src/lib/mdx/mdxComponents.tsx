import { Callout } from "@/components/mdx/Callout";
import { CodeBlock } from "@/components/mdx/CodeBlock";
import { Evidence } from "@/components/mdx/Evidence";
import { SpecCard } from "@/components/mdx/SpecCard";

export const MDX_ALLOWED_COMPONENTS = new Set<string>(["Callout", "SpecCard", "Evidence", "CodeBlock"]);

export const MDX_COMPONENTS = {
  pre: CodeBlock,
  CodeBlock,
  Callout,
  SpecCard,
  Evidence,
};
