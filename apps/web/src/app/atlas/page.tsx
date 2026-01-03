import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default function AtlasPage() {
  return (
    <main className="py-mdt-6">
      <Stack gap={7}>
        <Stack gap={3} className="max-w-2xl">
          <Heading level="h1">Atlas</Heading>
          <Text tone="muted">
            Docs-as-data for how agents interpret repository instructions, scoping, and imports.
          </Text>
        </Stack>

        <div className="grid gap-mdt-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { href: "/atlas/platforms", title: "Platforms", description: "Browse per-tool facts and examples." },
            { href: "/atlas/concepts", title: "Concepts", description: "Guides for key behaviors and constraints." },
            { href: "/atlas/recipes", title: "Recipes", description: "Copy-pastable patterns for safe workflows." },
            {
              href: "/atlas/simulator",
              title: "Simulator",
              description: "Scan a repo folder to preview loaded instructions per tool.",
            },
            { href: "/atlas/compare", title: "Compare", description: "Matrix view of feature support across tools." },
            { href: "/atlas/changelog", title: "Changelog", description: "What changed, when, and why." },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex h-full flex-col rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm hover:border-mdt-primary-soft hover:bg-mdt-surface-raised hover:shadow-mdt-md motion-reduce:transition-none",
                interactiveBase,
                focusRing
              )}
            >
              <div className="text-body-sm font-semibold text-mdt-text">{item.title}</div>
              <div className="mt-mdt-2 text-body-sm text-mdt-muted">{item.description}</div>
            </Link>
          ))}
        </div>
      </Stack>
    </main>
  );
}
