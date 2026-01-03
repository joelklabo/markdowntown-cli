import Link from "next/link";
import { listPublicItems, type PublicItemType } from "@/lib/publicItems";
import { listTopTags } from "@/lib/publicTags";
import { ArtifactRow, type ArtifactRowItem } from "@/components/library/ArtifactRow";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asArray(input?: string | string[]): string[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function parseType(input?: string): PublicItemType | "all" {
  if (input === "snippet" || input === "template" || input === "file" || input === "agent" || input === "skill") return input;
  return "all";
}

function parseHasScopes(input?: string): boolean | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return undefined;
}

export default async function LibraryPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const type = parseType(typeof searchParams.type === "string" ? searchParams.type : undefined);

  const tags = [
    ...asArray(searchParams.tag),
    ...(typeof searchParams.tags === "string"
      ? searchParams.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []),
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  const targets = [
    ...asArray(searchParams.target),
    ...(typeof searchParams.targets === "string"
      ? searchParams.targets
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []),
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  const hasScopes = parseHasScopes(typeof searchParams.hasScopes === "string" ? searchParams.hasScopes : undefined);

  const [items, topTags] = await Promise.all([
    listPublicItems({
      limit: 100,
      sort: "recent",
      type,
      tags,
      targets,
      hasScopes,
      search: q.length > 0 ? q : null,
    }),
    listTopTags(24, 30),
  ]);

  const availableTargets = Array.from(new Set(items.flatMap((i) => i.targets))).sort((a, b) => a.localeCompare(b));
  const rowItems: ArtifactRowItem[] = items.map((item) => ({
    id: item.id,
    slug: item.slug ?? undefined,
    title: item.title,
    description: item.description,
    tags: item.tags,
    targets: item.targets,
    hasScopes: item.hasScopes,
    stats: item.stats,
    type: item.type,
  }));
  const hasFilters = q.length > 0 || type !== "all" || tags.length > 0 || targets.length > 0 || hasScopes === true;

  return (
    <Container className="py-mdt-10 md:py-mdt-12">
      <Stack gap={8}>
        <Stack gap={2}>
          <Text size="caption" tone="muted" className="uppercase tracking-wide">
            Public library
          </Text>
          <Heading level="h1">Library</Heading>
          <Text tone="muted" className="max-w-2xl">
            Browse public artifacts and open them in Workbench to export agents.md. Use filters when you need to narrow down by tool, tags, or scopes.
          </Text>
        </Stack>

        <div className="grid gap-mdt-8 lg:grid-cols-[320px_1fr]">
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <LibraryFilters
              q={q}
              type={type}
              tags={tags}
              targets={targets}
              hasScopes={hasScopes}
              topTags={topTags}
              availableTargets={availableTargets.length > 0 ? availableTargets : ["agents-md", "github-copilot"]}
            />
          </div>

          <div className="min-w-0 space-y-mdt-5">
            <div className="flex flex-col gap-mdt-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Text size="caption" tone="muted">Results</Text>
                <Heading level="h3" as="h2">
                  {q.length > 0 ? `Results for “${q}”` : "Public artifacts"}
                </Heading>
              </div>
              <Text size="caption" tone="muted">
                {rowItems.length} result{rowItems.length === 1 ? "" : "s"}
              </Text>
            </div>
            {rowItems.map((item) => (
              <ArtifactRow key={item.id} item={item} />
            ))}

            {rowItems.length === 0 && (
              <Card className="space-y-mdt-4 text-center" padding="lg" tone="raised">
                <Heading level="h3" as="h2">
                  No public items match those filters
                </Heading>
                <Text tone="muted" className="mx-auto max-w-xl">
                  {hasFilters
                    ? "Try clearing filters or searching fewer tags. You can also scan your own folder to get a tailored setup."
                    : "Check back soon, or scan your own folder to get a tailored setup."}
                </Text>
                <div className="flex flex-wrap justify-center gap-mdt-2">
                  <Button size="sm" asChild>
                    <Link href="/atlas/simulator">Scan a folder</Link>
                  </Button>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href="/library">Clear filters</Link>
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Stack>
    </Container>
  );
}
