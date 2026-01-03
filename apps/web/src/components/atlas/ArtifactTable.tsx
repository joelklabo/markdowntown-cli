import { EvidenceBadge } from "@/components/atlas/EvidenceBadge";
import { PathChip } from "@/components/atlas/PathChip";
import { Text } from "@/components/ui/Text";
import type { ArtifactSpec } from "@/lib/atlas/types";

type ArtifactTableProps = {
  artifacts: ArtifactSpec[];
};

export function ArtifactTable({ artifacts }: ArtifactTableProps) {
  return (
    <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
      <div className="flex items-center justify-between gap-mdt-3">
        <div className="text-body-sm font-semibold text-mdt-text">Artifacts</div>
        <div className="text-caption text-mdt-muted">{artifacts.length}</div>
      </div>

      {artifacts.length === 0 ? (
        <Text className="mt-mdt-3" size="bodySm" tone="muted">
          No artifacts recorded yet.
        </Text>
      ) : (
        <div className="mt-mdt-4 space-y-mdt-3">
          {artifacts.map((artifact) => (
            <div
              key={`${artifact.kind}:${artifact.label}`}
              className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3"
            >
              <div className="flex items-start justify-between gap-mdt-3">
                <div>
                  <div className="text-body-sm font-medium text-mdt-text">{artifact.label}</div>
                  <div className="mt-mdt-1 font-mono text-caption text-mdt-muted">{artifact.kind}</div>
                </div>
                {artifact.docs ? <EvidenceBadge url={artifact.docs} label="Docs" /> : null}
              </div>

              {artifact.description ? (
                <div className="mt-mdt-2 text-body-sm text-mdt-muted">{artifact.description}</div>
              ) : null}

              <div className="mt-mdt-3 flex flex-wrap gap-mdt-2">
                {artifact.paths.map((item) => (
                  <PathChip key={item} path={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
