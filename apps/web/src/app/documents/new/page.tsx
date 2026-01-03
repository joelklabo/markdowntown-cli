import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DocumentForm } from "@/components/documents/DocumentForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

export default async function NewDocumentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/documents/new");

  return (
    <main id="main-content" className="py-mdt-8">
      <Container size="md" padding="md">
        <Stack gap={6}>
          <Breadcrumb
            segments={[
              { href: "/", label: "Home" },
              { href: "/documents", label: "Documents" },
              { label: "New" },
            ]}
          />
          <Stack gap={2}>
            <Heading level="display" leading="tight">New agents.md</Heading>
            <Text tone="muted">Create a document to assemble snippets and templates.</Text>
          </Stack>
          <DocumentForm />
        </Stack>
      </Container>
    </main>
  );
}
