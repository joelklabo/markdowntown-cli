import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { normalizeTags } from "@/lib/tags";
import { Container } from "@/components/ui/Container";
import { Stack, Row } from "@/components/ui/Stack";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/documents");

  const docs = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={8}>
          <Row wrap align="center" justify="between" gap={4}>
            <Stack gap={2}>
              <Text size="caption" tone="muted">Documents</Text>
              <Heading level="display" leading="tight">Your agents.md files</Heading>
            </Stack>
            <Button asChild>
              <Link href="/documents/new">New document</Link>
            </Button>
          </Row>

          <div className="grid gap-mdt-4 sm:grid-cols-2">
            {docs.map((doc) => {
              const tags = normalizeTags(doc.tags, { strict: false }).tags;
              return (
                <Card key={doc.id} className="space-y-mdt-3 p-mdt-5">
                  <Row align="center" justify="between" gap={2}>
                    <Heading level="h3" as="h3">{doc.title}</Heading>
                    <Button variant="secondary" size="xs" asChild>
                      <Link href={`/documents/${doc.id}`}>Edit</Link>
                    </Button>
                  </Row>
                  <Text size="bodySm" tone="muted" className="line-clamp-2">{doc.description}</Text>
                  <Row wrap gap={2}>
                    {tags.map((tag) => (
                      <Pill key={tag} tone="gray">#{tag}</Pill>
                    ))}
                  </Row>
                  <Text size="caption" tone="muted">Updated {doc.updatedAt.toDateString()}</Text>
                </Card>
              );
            })}
            {docs.length === 0 && (
              <Card className="p-mdt-6">
                <Text size="bodySm" tone="muted">
                  No documents yet. Create your first agents.md.
                </Text>
              </Card>
            )}
          </div>
        </Stack>
      </Container>
    </main>
  );
}
