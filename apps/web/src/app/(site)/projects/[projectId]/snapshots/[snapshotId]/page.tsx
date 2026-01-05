import { requireSession } from "@/lib/requireSession";
import { getSnapshotWithRuns } from "@/lib/api/projects";
import { RunPanel } from "@/components/snapshots/RunPanel";
import { RunResults } from "@/components/snapshots/RunResults";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { FileTree } from "@/components/ui/FileTree";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { strings } from "@/lib/strings";

export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ projectId: string; snapshotId: string }>;
}) {
  const { session } = await requireSession();
  if (!session) {
    redirect("/signin");
  }

  const { projectId, snapshotId } = await params;
  const snapshot = await getSnapshotWithRuns(session.user.id, snapshotId);

  if (!snapshot || snapshot.projectId !== projectId) {
    notFound();
  }

  const filePaths = snapshot.files.map((f) => f.path);

  return (
    <Container padding="lg">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2 text-sm text-mdt-muted">
          <Link href="/projects" className="hover:text-mdt-text transition-colors">
            {strings.projects.title}
          </Link>
          <span>/</span>
          <Link href={`/projects/${projectId}`} className="hover:text-mdt-text transition-colors">
            {snapshot.project.name}
          </Link>
          <span>/</span>
          <span className="text-mdt-text font-mono">{snapshot.id.slice(0, 8)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <Heading level="h1" className="font-mono">
            Snapshot {snapshot.id.slice(0, 8)}
          </Heading>
          <Text tone="muted" size="caption">
            Created on {new Date(snapshot.createdAt).toLocaleString()}
          </Text>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-8">
          <RunPanel snapshotId={snapshotId} initialRuns={snapshot.runs} />
          <RunResults runs={snapshot.runs} />
        </div>

        <div className="flex flex-col gap-4">
          <Heading level="h3">Files ({filePaths.length})</Heading>
          <Card padding="sm" tone="default" className="max-h-[600px] overflow-auto">
            <FileTree paths={filePaths} />
          </Card>
        </div>
      </div>
    </Container>
  );
}
