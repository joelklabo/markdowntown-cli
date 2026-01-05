import { ProjectCard } from "./ProjectCard";
import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import type { Project } from "@prisma/client";
import { strings } from "@/lib/strings";

interface ProjectsListProps {
  projects: (Project & { _count: { snapshots: number } })[];
}

export function ProjectsList({ projects }: ProjectsListProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <Text tone="muted">
          {strings.projects.empty}
        </Text>
      </div>
    );
  }

  return (
    <Grid minColWidth="300px" gap={6}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </Grid>
  );
}
