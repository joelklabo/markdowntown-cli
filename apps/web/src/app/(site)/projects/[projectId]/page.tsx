import { requireSession } from "@/lib/requireSession";
import { getProject } from "@/lib/api/projects";
import { SnapshotList } from "@/components/snapshots/SnapshotList";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { strings } from "@/lib/strings";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { session } = await requireSession();
  if (!session) {
    redirect("/signin");
  }

  const { projectId } = await params;
  const project = await getProject(session.user.id, projectId);

  if (!project) {
    notFound();
  }

  return (
    <Container padding="lg">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:underline">
            {strings.projects.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">{project.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <Heading level="h1">{project.name}</Heading>
          <Button asChild>
            <Link href={`/projects/${projectId}/upload`}>
              {strings.snapshots.upload}
            </Link>
          </Button>
        </div>
        {project.description && (
          <Text tone="muted">{project.description}</Text>
        )}
      </div>

      <Heading level="h2" className="mb-4">
        {strings.snapshots.title}
      </Heading>
      <SnapshotList snapshots={project.snapshots} />
    </Container>
  );
}
