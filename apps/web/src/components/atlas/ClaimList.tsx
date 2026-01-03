import { EvidenceBadge } from "@/components/atlas/EvidenceBadge";
import { Pill } from "@/components/ui/Pill";
import { Text } from "@/components/ui/Text";
import type { Claim, ClaimConfidence } from "@/lib/atlas/types";

type ClaimListProps = {
  claims: Claim[];
};

function confidenceTone(confidence: ClaimConfidence): React.ComponentProps<typeof Pill>["tone"] {
  if (confidence === "high") return "green";
  if (confidence === "medium") return "yellow";
  return "gray";
}

export function ClaimList({ claims }: ClaimListProps) {
  return (
    <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
      <div className="flex items-center justify-between gap-mdt-3">
        <div className="text-body-sm font-semibold text-mdt-text">Claims</div>
        <div className="text-caption text-mdt-muted">{claims.length}</div>
      </div>
      <div className="mt-mdt-2 text-body-xs text-mdt-muted">Statements with citations about platform behavior.</div>

      {claims.length === 0 ? (
        <Text className="mt-mdt-3" size="bodySm" tone="muted">
          No claims yet.
        </Text>
      ) : (
        <ul className="mt-mdt-4 space-y-mdt-3">
          {claims.map((claim) => (
            <li key={claim.id} className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
              <div className="flex items-start justify-between gap-mdt-3">
                <div>
                  <div className="text-body-sm font-medium text-mdt-text">{claim.statement}</div>
                  <div className="mt-mdt-1 font-mono text-caption text-mdt-muted">{claim.id}</div>
                </div>
                <Pill tone={confidenceTone(claim.confidence)}>{claim.confidence}</Pill>
              </div>

              <div className="mt-mdt-3 flex flex-wrap gap-mdt-2">
                {claim.evidence.map((evidence) => (
                  <EvidenceBadge key={evidence.url} url={evidence.url} label={evidence.title ?? undefined} />
                ))}
              </div>

              {claim.evidence.some((item) => item.excerpt) ? (
                <div className="mt-mdt-3 space-y-mdt-2">
                  {claim.evidence
                    .filter((item) => item.excerpt)
                    .map((item) => (
                      <blockquote
                        key={`${claim.id}:${item.url}`}
                        className="rounded-mdt-md border border-mdt-border bg-mdt-surface px-mdt-3 py-mdt-2 text-body-xs text-mdt-muted"
                      >
                        {item.excerpt}
                      </blockquote>
                    ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
