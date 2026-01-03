import Link from "next/link";
import type { Metadata } from "next";
import { listPublicItems, type PublicItem } from "@/lib/publicItems";
import { listTopTags } from "@/lib/publicTags";
import { normalizeTags } from "@/lib/tags";
import { LibraryCard } from "@/components/LibraryCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Container } from "@/components/ui/Container";
import { Stack, Row } from "@/components/ui/Stack";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Surface } from "@/components/ui/Surface";

type TagParams = { tag: string };

export async function generateMetadata({ params }: { params: Promise<TagParams> }): Promise<Metadata> {
  const { tag } = await params;
  const title = `#${tag} snippets & templates | mark downtown`;
  return { title, description: `Browse snippets, templates, and files tagged #${tag}.` };
}

function toCard(item: PublicItem) {
  return {
    id: item.id,
    slug: item.slug ?? undefined,
    title: item.title,
    description: item.description || "Markdown snippet",
    tags: normalizeTags(item.tags, { strict: false }).tags,
    stats: item.stats,
    type: item.type,
  };
}

export default async function TagDetail({ params }: { params: Promise<TagParams> }) {
  const { tag } = await params;
  const normalized = normalizeTags(tag, { strict: false }).tags[0] ?? tag;

  const items = await listPublicItems({ limit: 48, tags: [normalized], sort: "recent" });
  const cards = items.map(toCard);

  const popularTagsRaw = await listTopTags(12, 30);
  const popularTags = popularTagsRaw.length ? popularTagsRaw.map((t) => t.tag) : [];

  return (
    <main id="main-content" className="py-mdt-8">
      <Container size="lg" padding="md">
        <Stack gap={8}>
          <Breadcrumb
            segments={[
              { href: "/", label: "Home" },
              { href: "/tags", label: "Tags" },
              { label: `#${normalized}` },
            ]}
          />

          <Surface tone="subtle" padding="lg" className="space-y-mdt-2">
            <Text size="caption" tone="muted">Tag</Text>
            <Heading level="display" leading="tight">#{normalized}</Heading>
            <Text tone="muted" className="max-w-3xl">
              Snippets, templates, and agents.md files labeled with <strong>#{normalized}</strong>.
            </Text>
            {popularTags.length > 0 && (
              <Row wrap gap={2} className="text-xs text-mdt-muted">
                <Text as="span" size="caption" tone="muted">Popular:</Text>
                {popularTags.map((t) => (
                  <Link key={t} href={`/tags/${t}`} className="underline hover:text-mdt-text">
                    #{t}
                  </Link>
                ))}
              </Row>
            )}
          </Surface>

          <div className="grid gap-mdt-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((item) => (
              <LibraryCard key={item.id} item={item} />
            ))}
            {cards.length === 0 && (
              <Text className="sm:col-span-2 lg:col-span-3" size="bodySm" tone="muted">
                No items tagged #{normalized} yet.
              </Text>
            )}
          </div>
        </Stack>
      </Container>
    </main>
  );
}
