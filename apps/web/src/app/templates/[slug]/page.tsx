import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import type { Metadata } from "next";
import { TemplateFormPreview, type TemplateField } from "@/components/template/TemplateFormPreview";
import { renderTemplateBody } from "@/lib/renderTemplate";
import { LibraryCard } from "@/components/LibraryCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getPublicTemplate, type PublicTemplate } from "@/lib/publicTemplates";
import { listPublicItems, type PublicItem } from "@/lib/publicItems";
import { normalizeTags } from "@/lib/tags";
import { TemplateActions } from "@/components/template/TemplateActions";
import { DetailTabs } from "@/components/detail/DetailTabs";
import { DetailStats } from "@/components/detail/DetailStats";
import { DetailWarning } from "@/components/detail/DetailWarning";
import { FeedbackCTA } from "@/components/detail/FeedbackCTA";
import { Container } from "@/components/ui/Container";
import { Stack, Row } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

type TemplateParams = { slug: string };

export const revalidate = 300;

type TemplateView = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string;
  tags: string[];
  stats: { views: number; copies: number; votes: number };
  badge?: string;
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
};

export async function generateMetadata({ params }: { params: Promise<TemplateParams> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicTemplate(slug);
  if (!item) return { title: "Template not found" };
  return {
    title: `${item.title} | mark downtown`,
    description: item.description ?? "",
  };
}

export default async function TemplateDetail({ params }: { params: Promise<TemplateParams> }) {
  const { slug } = await params;
  const template: PublicTemplate | null = await getPublicTemplate(slug);
  if (!template) return notFound();

  const data: TemplateView = {
    id: template.id,
    slug: template.slug,
    title: template.title,
    description: template.description ?? "",
    body: template.body ?? "",
    tags: template.tags,
    stats: { views: template.stats.views, copies: template.stats.copies, votes: template.stats.uses ?? 0 },
    badge: (template as { badge?: string }).badge,
    visibility: (template as { visibility?: TemplateView["visibility"] }).visibility ?? "PUBLIC",
  };

  const fields: TemplateField[] = Array.isArray((template as { fields?: TemplateField[] }).fields)
    ? ((template as { fields?: TemplateField[] }).fields as TemplateField[])
    : [];
  const body = data.body ?? "";
  const tags = normalizeTags(data.tags ?? [], { strict: false }).tags;
  const stats = data.stats ?? { views: 0, copies: 0, votes: 0 };

  const relatedPublic = await listPublicItems({ limit: 6, tags, type: "template" });
  const toCard = (item: PublicItem) => ({
    id: item.id,
    slug: item.slug ?? undefined,
    title: item.title,
    description: item.description ?? "",
    tags: normalizeTags(item.tags, { strict: false }).tags,
    stats: item.stats,
    type: item.type,
  });
  const related = relatedPublic.filter((rel) => rel.id !== data.id).map(toCard).slice(0, 3);

  const initialValues = Object.fromEntries(fields.map((f) => [f.name, f.placeholder ?? (f.required ? "" : "")]));
  const initialRendered = renderTemplateBody(body, initialValues);
  const visibility = data.visibility ?? "PUBLIC";

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={10}>
          <Breadcrumb
            segments={[
              { href: "/", label: "Home" },
              { href: "/templates", label: "Templates" },
              { label: data.title },
            ]}
          />

          <Surface
            tone="raised"
            padding="lg"
            className="sticky top-16 z-10 space-y-mdt-6 bg-[color:var(--mdt-color-surface)]/95 shadow-mdt-md backdrop-blur-md"
          >
            <DetailWarning visibility={visibility} type="template" />

            <div className="grid gap-mdt-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <Stack gap={3} className="min-w-0">
                <Row wrap gap={2} className="items-center">
                  <Pill tone="blue">Template</Pill>
                  {data.badge && <Pill tone="yellow">{data.badge}</Pill>}
                </Row>
                <Heading level="display" leading="tight">{data.title}</Heading>
                <Text tone="muted" className="max-w-3xl" leading="relaxed">{data.description}</Text>
                <Row wrap gap={2}>
                  {tags.map((tag) => (
                    <Pill key={tag} tone="gray">#{tag}</Pill>
                  ))}
                </Row>
              </Stack>
              <Stack gap={4} align="end" className="w-full lg:w-[280px]">
                <TemplateActions id={data.id} slug={data.slug} title={data.title} rendered={initialRendered} />
                <DetailStats views={stats.views} copies={stats.copies} votes={stats.votes} />
              </Stack>
            </div>
          </Surface>

          <TemplateFormPreview title={data.title} body={body} fields={fields} />

          <DetailTabs title={data.title} rendered={initialRendered} raw={body} copyLabel="Copy" />

          <Surface padding="md" className="space-y-mdt-4">
            <Heading level="h3" as="h4">Related templates</Heading>
            <div className="grid gap-mdt-4 sm:grid-cols-2">
              {related.map((rel) => (
                <LibraryCard key={rel.id} item={rel} />
              ))}
              {related.length === 0 && (
                <Text size="bodySm" tone="muted">No related templates yet.</Text>
              )}
            </div>
          </Surface>

          <FeedbackCTA title="template" />
        </Stack>

        <Surface
          as="div"
          tone="raised"
          padding="sm"
          className="fixed inset-x-0 bottom-0 z-20 bg-[color:var(--mdt-color-surface)]/95 shadow-mdt-lg backdrop-blur-md md:hidden"
        >
          <Row align="center" justify="between" gap={3}>
            <Stack gap={0}>
              <Text size="bodySm" weight="semibold">Use this template</Text>
              <Text size="caption" tone="muted">{data.title}</Text>
            </Stack>
            <TemplateActions id={data.id} slug={data.slug} title={data.title} rendered={initialRendered} variant="bar" />
          </Row>
        </Surface>
      </Container>
    </main>
  );
}
