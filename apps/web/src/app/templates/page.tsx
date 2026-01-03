import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Templates | mark downtown",
  description: "Browse templates in the public library.",
};

export default async function TemplatesPage() {
  redirect("/library?type=template");
}
