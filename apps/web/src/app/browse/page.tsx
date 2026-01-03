import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Library | mark downtown",
  description: "Browse public artifacts and open them in Workbench.",
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await searchParams) ?? {};
  const qs = new URLSearchParams();

  const q = typeof resolved.q === "string" ? resolved.q.trim() : "";
  if (q.length > 0) qs.set("q", q);

  const type = typeof resolved.type === "string" ? resolved.type.trim() : "";
  if (type.length > 0 && type !== "all") qs.set("type", type);

  const tag = resolved.tag;
  if (typeof tag === "string") qs.append("tag", tag);
  else if (Array.isArray(tag)) tag.forEach((t) => qs.append("tag", t));

  const tags = resolved.tags;
  if (typeof tags === "string") {
    const normalized = tags.trim();
    if (normalized.length > 0) qs.set("tags", normalized);
  } else if (Array.isArray(tags)) {
    tags.forEach((t) => qs.append("tag", t));
  }

  const target = resolved.target;
  if (typeof target === "string") qs.append("target", target);
  else if (Array.isArray(target)) target.forEach((t) => qs.append("target", t));

  const targets = resolved.targets;
  if (typeof targets === "string") {
    const normalized = targets.trim();
    if (normalized.length > 0) qs.set("targets", normalized);
  } else if (Array.isArray(targets)) {
    targets.forEach((t) => qs.append("target", t));
  }

  const hasScopes = resolved.hasScopes;
  if (typeof hasScopes === "string") {
    const normalized = hasScopes.trim();
    if (normalized.length > 0) qs.set("hasScopes", normalized);
  } else if (Array.isArray(hasScopes) && hasScopes[0]) {
    qs.set("hasScopes", hasScopes[0]);
  }

  const query = qs.toString();
  redirect(query.length > 0 ? `/library?${query}` : "/library");
}
