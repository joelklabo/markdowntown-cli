import { requireSession } from "@/lib/requireSession";
import { getUserProjects } from "@/lib/api/projects";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import Link from "next/link";
import { redirect } from "next/navigation";
import { strings } from "@/lib/strings";

export default async function ProjectsPage() {
  const { session } = await requireSession();
  if (!session) {
    redirect("/signin?callbackUrl=/projects");
  }

  const projects = await getUserProjects(session.user.id);

  return (
    <Container padding="lg">
      <div className="flex justify-between items-center mb-6">
        <Heading level="h1">{strings.projects.title}</Heading>
        <Button asChild>
          <Link href="/projects/new">{strings.projects.new}</Link>
        </Button>
      </div>
      <ProjectsList projects={projects} />
    </Container>
  );
}
