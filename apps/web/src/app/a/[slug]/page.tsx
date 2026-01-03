import { ArtifactActions } from "@/components/artifact/ArtifactActions";
import { ArtifactDetailTabs } from "@/components/artifact/ArtifactDetailTabs";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Pill } from "@/components/ui/Pill";
import { Row, Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { getPublicItem } from "@/lib/publicItems";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function extractLicense(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const record = content as Record<string, unknown>;

  const metaLike = (record.meta ?? record.metadata) as unknown;
  if (!metaLike || typeof metaLike !== "object") return null;
  const license = (metaLike as Record<string, unknown>).license;
  if (typeof license !== "string") return null;
  const trimmed = license.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function ArtifactDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getPublicItem(slug);

  if (!item) notFound();

  const license = extractLicense(item.content) ?? "Unspecified";

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={10}>
          <Surface tone="raised" padding="lg" className="space-y-mdt-6">
            <div className="grid gap-mdt-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <Stack gap={4} className="min-w-0">
                <Row gap={2} align="center" className="flex-wrap">
                  <Pill tone="blue">{item.type}</Pill>
                  <Text size="caption" tone="muted">
                    v{item.version}
                  </Text>
                  <Text size="caption" tone="muted">
                    Updated {formatDate(item.updatedAt)}
                  </Text>
                  <Text size="caption" tone="muted">
                    License: {license}
                  </Text>
                </Row>

                <Heading level="display" leading="tight">{item.title}</Heading>

                {item.description && item.description.trim().length > 0 && (
                  <Text tone="muted" leading="relaxed" className="max-w-3xl">
                    {item.description}
                  </Text>
                )}

                {item.targets.length > 0 && (
                  <Row gap={2} className="flex-wrap">
                    {item.targets.map((t) => (
                      <Pill key={t} tone="gray">
                        {t}
                      </Pill>
                    ))}
                  </Row>
                )}

                <Row gap={2} className="flex-wrap">
                  <Pill tone="green">{item.scopeCount} scopes</Pill>
                  <Pill tone="green">{item.blockCount} blocks</Pill>
                  {item.lintGrade && <Pill tone="yellow">Lint {item.lintGrade}</Pill>}
                  {!item.hasScopes && <Pill tone="gray">Global only</Pill>}
                </Row>

                {item.tags.length > 0 && (
                  <Row gap={2} className="flex-wrap">
                    {item.tags.map((t) => (
                      <Pill key={t} tone="gray">
                        #{t}
                      </Pill>
                    ))}
                  </Row>
                )}
              </Stack>

              <div className="flex w-full flex-col gap-mdt-3 lg:w-auto">
                <ArtifactActions artifactId={item.id} slug={item.slug ?? slug} uam={item.content} targets={item.targets} />
              </div>
            </div>
          </Surface>

          <ArtifactDetailTabs
            artifactId={item.id}
            version={item.version}
            uam={item.content}
            targets={item.targets}
            lintGrade={item.lintGrade}
          />
        </Stack>
      </Container>
    </main>
  );
}
