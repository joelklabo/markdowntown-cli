import { EvidenceBadge } from "@/components/atlas/EvidenceBadge";
import { ChangelogDiff } from "@/components/atlas/ChangelogDiff";
import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import { loadAtlasChangelogEntry, loadAtlasFacts } from "@/lib/atlas/load";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type EntryParams = { entryId: string };

function isoDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export default async function AtlasChangelogEntryPage({ params }: { params: Promise<EntryParams> }) {
  const { entryId } = await params;
  const entry = loadAtlasChangelogEntry(entryId);
  if (!entry) return notFound();

  const date = isoDate(entry.date);

  const impacted = entry.impactedClaims.map((item) => {
    try {
      const facts = loadAtlasFacts(item.platformId);
      const claim = facts.claims.find((c) => c.id === item.claimId) ?? null;
      return { ...item, claim, platformName: facts.name };
    } catch {
      return { ...item, claim: null, platformName: item.platformId };
    }
  });

  return (
    <main className="py-mdt-4">
      <Stack gap={6}>
        <Stack gap={3}>
          <Heading level="h1">{entry.summary}</Heading>
          <Text tone="muted">
            <span className="font-mono text-mdt-text">{entry.id}</span>
            <span className="mx-mdt-2" aria-hidden>
              ·
            </span>
            <span>{date ?? "—"}</span>
          </Text>
        </Stack>

        <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
          <div className="text-body-sm font-semibold text-mdt-text">Impacted claims</div>
          <div className="mt-mdt-2 text-body-xs text-mdt-muted">Claims referenced by this entry.</div>

          {impacted.length === 0 ? (
            <Text className="mt-mdt-3" size="bodySm" tone="muted">
              No impacted claims recorded.
            </Text>
          ) : (
            <ul className="mt-mdt-4 space-y-mdt-3">
              {impacted.map((item) => (
                <li key={`${item.platformId}:${item.claimId}`} className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
                  <div className="flex items-start justify-between gap-mdt-3">
                    <div>
                      <div className="text-body-sm font-medium text-mdt-text">
                        {item.claim?.statement ?? item.claimId}
                      </div>
                      <div className="mt-mdt-1 text-caption text-mdt-muted">
                        <span className="font-mono text-mdt-text">{item.platformId}</span>
                        <span className="mx-mdt-2" aria-hidden>
                          ·
                        </span>
                        <span className="font-mono">{item.claimId}</span>
                      </div>
                    </div>
                    <Link
                      href={`/atlas/platforms/${item.platformId}`}
                      className={cn(
                        "text-caption text-mdt-muted underline decoration-mdt-border underline-offset-2 hover:text-mdt-text",
                        interactiveBase,
                        focusRing
                      )}
                    >
                      {item.platformName}
                    </Link>
                  </div>

                  {item.claim ? (
                    <div className="mt-mdt-3 flex flex-wrap gap-mdt-2">
                      {item.claim.evidence.map((evidence) => (
                        <EvidenceBadge key={evidence.url} url={evidence.url} label={evidence.title ?? undefined} />
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-mdt-xl border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm">
          <div className="text-body-sm font-semibold text-mdt-text">Facts diff</div>
          <div className="mt-mdt-2 text-body-xs text-mdt-muted">Structured diffs for facts JSON.</div>

          {entry.diffs.length === 0 ? (
            <Text className="mt-mdt-3" size="bodySm" tone="muted">
              No diffs recorded.
            </Text>
          ) : (
            <div className="mt-mdt-4 space-y-mdt-4">
              {entry.diffs.map((diff) => (
                <div key={diff.platformId} className="rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-3">
                  <div className="font-mono text-caption text-mdt-muted">{diff.platformId}</div>
                  <div className="mt-mdt-3">
                    <ChangelogDiff before={diff.before ?? undefined} after={diff.after ?? undefined} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </Stack>
    </main>
  );
}
