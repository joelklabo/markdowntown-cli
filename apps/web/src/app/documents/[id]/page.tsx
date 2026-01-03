import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTags } from "@/lib/tags";
import { DocumentForm } from "@/components/documents/DocumentForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

type Params = { id: string };

export default async function EditDocumentPage({ params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/documents");
  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!doc) return notFound();

  return (
    <main id="main-content" className="py-mdt-10 md:py-mdt-12">
      <Container size="md" padding="md">
        <Stack gap={8}>
          <Breadcrumb
            segments={[
              { href: "/", label: "Home" },
              { href: "/documents", label: "Documents" },
              { label: doc.title },
            ]}
          />
          <Stack gap={3}>
            <Heading level="display" leading="tight">Edit agents.md</Heading>
            <Text tone="muted">Update content, then save and export.</Text>
          </Stack>
          <DocumentForm
            initial={{
              id: doc.id,
              title: doc.title,
              description: doc.description,
              renderedContent: doc.renderedContent ?? "",
              tags: normalizeTags(doc.tags, { strict: false }).tags,
            }}
          />
        </Stack>
      </Container>
    </main>
  );
}
