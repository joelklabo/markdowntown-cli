import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Tags | mark downtown",
  description: "Explore tags to find snippets, templates, and agents.md files by topic.",
};

export default async function TagsPage() {
  redirect("/library");
}
