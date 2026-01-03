import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { FileActions } from "@/components/file/FileActions";
import { DetailTabs } from "@/components/detail/DetailTabs";
import { DetailStats } from "@/components/detail/DetailStats";
import { DetailWarning } from "@/components/detail/DetailWarning";
import { FeedbackCTA } from "@/components/detail/FeedbackCTA";
import { Container } from "@/components/ui/Container";
import { Stack, Row } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { hasDatabaseEnv, prisma } from "@/lib/prisma";
import { normalizeTags } from "@/lib/tags";

type FileParams = { id: string };

async function getPublicFile(idOrSlug: string) {
  if (!hasDatabaseEnv) return null;
  try {
    const row = await prisma.document.findFirst({
      where: {
        visibility: "PUBLIC",
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        renderedContent: true,
        tags: true,
        views: true,
        copies: true,
        visibility: true,
      },
    });
    return row ? { ...row, tags: normalizeTags(row.tags, { strict: false }).tags } : null;
  } catch (err) {
    console.warn("publicFile: falling back to empty result", err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<FileParams> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getPublicFile(id);
  if (!item) return { title: "agents.md not found" };
  return {
    title: `${item.title} | mark downtown`,
    description: item.description ?? "",
  };
}

export default async function FileDetail({ params }: { params: Promise<FileParams> }) {
  const { id } = await params;
  const item = await getPublicFile(id);
  if (!item) return notFound();

  const renderedContent = item.renderedContent ?? item.description ?? "";
  const tags = normalizeTags(item.tags ?? [], { strict: false }).tags;
  const visibility = item.visibility ?? "PUBLIC";

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={8}>
          <Breadcrumb
            segments={[
              { href: "/", label: "Home" },
              { href: "/browse", label: "Browse" },
              { label: item.title },
            ]}
          />

          <Surface tone="raised" padding="lg" className="space-y-mdt-4">
            <DetailWarning visibility={visibility} type="file" />

            <Row wrap gap={4} justify="between" align="start" className="items-start">
              <Stack gap={3} className="min-w-0">
                <Row wrap gap={2} className="items-center">
                  <Pill tone="blue">agents.md</Pill>
                </Row>
                <Heading level="display" leading="tight">{item.title}</Heading>
                {item.description && <Text tone="muted" className="max-w-3xl">{item.description}</Text>}
                <Row wrap gap={2}>
                  {tags.map((tag) => (
                    <Pill key={tag} tone="gray">#{tag}</Pill>
                  ))}
                </Row>
                <FileActions
                  id={item.id}
                  slug={item.slug ?? item.id}
                  title={item.title}
                  content={renderedContent}
                  builderHref={`/workbench?clone=${item.slug ?? item.id}`}
                />
              </Stack>
              <Stack gap={2} align="end" className="w-full md:w-auto">
                <DetailStats views={item.views ?? 0} copies={item.copies ?? 0} votes={0} />
              </Stack>
            </Row>
          </Surface>

          <DetailTabs title={item.title} rendered={renderedContent} raw={renderedContent} copyLabel="Copy" />

          <FeedbackCTA title="agents.md file" />
        </Stack>
      </Container>
    </main>
  );
}
