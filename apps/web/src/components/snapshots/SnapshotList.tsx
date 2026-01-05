import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Grid } from "@/components/ui/Grid";
import type { Snapshot } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { strings } from "@/lib/strings";

interface SnapshotListProps {
  snapshots: (Snapshot & { _count: { files: number } })[];
}

export function SnapshotList({ snapshots }: SnapshotListProps) {
  if (snapshots.length === 0) {
    return (
      <div className="text-center py-12">
        <Text tone="muted">{strings.snapshots.empty}</Text>
      </div>
    );
  }

  return (
    <Grid minColWidth="300px" gap={4}>
      {snapshots.map((snapshot) => (
        <Card key={snapshot.id} className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <Heading level="h3" className="font-mono">
              {snapshot.id.slice(0, 8)}
            </Heading>
            <Text tone="muted" size="caption">
              {new Date(snapshot.createdAt).toLocaleDateString()}
            </Text>
          </div>
          <Text tone="muted" size="bodySm">
            {snapshot._count.files} {strings.snapshots.files} • {snapshot.status}
          </Text>
          <div className="mt-2">
            <Button asChild size="xs" variant="secondary">
              <Link href={`/snapshots/${snapshot.id}`}>{strings.snapshots.view}</Link>
            </Button>
          </div>
        </Card>
      ))}
    </Grid>
  );
}
