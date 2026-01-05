import { requireSession } from "@/lib/requireSession";
import { findOrCreateWorkspace } from "@/lib/workspace";
import { WorkspaceContainer } from "@/components/workspace/WorkspaceContainer";
import { Container } from "@/components/ui/Container";
import { redirect, notFound } from "next/navigation";
import { WorkspaceData } from "@/lib/workspace/serialize";
import { prisma } from "@/lib/prisma";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string; snapshotId: string }>;
}) {
  const { session } = await requireSession();
  if (!session) {
    redirect("/signin");
  }

  const { projectId, snapshotId } = await params;
  
  try {
    const workspace = await findOrCreateWorkspace(session.user.id, snapshotId);
    
    // Check if it belongs to the project
    if (workspace.snapshot.projectId !== projectId) {
      notFound();
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId }
    });

    const workspaceData: WorkspaceData = { workspace };

    // Fetch latest runs for this workspace or snapshot
    const runs = await prisma.run.findMany({
        where: {
            OR: [
                { workspaceId: workspace.id },
                { snapshotId: snapshotId, workspaceId: null }
            ]
        },
        orderBy: { createdAt: "desc" },
        take: 10
    });

    return (
      <Container padding="lg">
        <WorkspaceContainer
          initialData={workspaceData}
          projectId={projectId}
          snapshotId={snapshotId}
          projectName={project?.name || "Unknown Project"}
          initialRuns={runs}
        />
      </Container>
    );
  } catch (err) {
    console.error(err);
    notFound();
  }
}
