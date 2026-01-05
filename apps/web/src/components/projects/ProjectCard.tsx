import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import type { Project } from "@prisma/client";
import { strings } from "@/lib/strings";

interface ProjectCardProps {
  project: Project & { _count: { snapshots: number } };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <Heading level="h3">
          {project.name}
        </Heading>
        {project.description && (
          <Text tone="muted">{project.description}</Text>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between">
        <Text tone="muted" size="bodySm">
          {project._count.snapshots} {strings.projects.snapshots}
        </Text>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/projects/${project.id}`}>{strings.projects.view}</Link>
        </Button>
      </div>
    </Card>
  );
}
