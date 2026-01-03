import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { listAtlasGuideSlugs } from "@/lib/atlas/load";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

export const dynamic = "force-dynamic";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AtlasRecipesPage() {
  const slugs = listAtlasGuideSlugs("recipes");

  return (
    <main className="py-mdt-2">
      <Stack gap={4}>
        <Stack gap={2}>
          <Heading level="h1">Recipes</Heading>
          <Text tone="muted">Guides under atlas/guides/recipes/.</Text>
        </Stack>

        {slugs.length === 0 ? (
          <Text tone="muted">No recipes yet.</Text>
        ) : (
          <div className="grid gap-mdt-3">
            {slugs.map((slug) => (
              <Link
                key={slug}
                href={`/atlas/recipes/${slug}`}
                className={cn(
                  "rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm hover:bg-mdt-surface-raised",
                  interactiveBase,
                  focusRing
                )}
              >
                <div className="text-body-sm font-semibold text-mdt-text">{titleFromSlug(slug)}</div>
                <div className="mt-mdt-1 font-mono text-caption text-mdt-muted">{slug}</div>
              </Link>
            ))}
          </div>
        )}
      </Stack>
    </main>
  );
}
