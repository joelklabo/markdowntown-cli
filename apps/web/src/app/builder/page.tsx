import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Builder | mark downtown",
  description: "Builder has moved into Workbench—start there to assemble and export agents.md.",
};

export default async function BuilderPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const query = qs.toString();
  const workbenchHref = query.length > 0 ? `/workbench?${query}` : "/workbench";

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="sm" padding="md">
        <Stack gap={6}>
          <Stack gap={3} className="max-w-xl">
            <Text size="caption" tone="muted">Builder</Text>
            <Heading level="display" leading="tight">Builder lives inside Workbench now</Heading>
            <Text tone="muted" leading="relaxed">
              Start in Workbench to assemble scopes, edit instruction blocks, and export agents.md. We keep this page
              so older links still land in the right place.
            </Text>
          </Stack>

          <Card tone="subtle" padding="lg" className="space-y-mdt-4">
            <Heading level="h3" as="h2">Start here</Heading>
            <Text tone="muted" leading="relaxed">
              Workbench is the home for building and packaging agent instructions. It replaces the legacy Builder
              surface.
            </Text>
            <div className="flex flex-wrap gap-mdt-2">
              <Button asChild>
                <Link href={workbenchHref}>Open Workbench</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/atlas/simulator">Scan a folder</Link>
              </Button>
            </div>
          </Card>
        </Stack>
      </Container>
    </main>
  );
}
