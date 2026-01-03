import { WorkbenchPageClient } from '@/components/workbench/WorkbenchPageClient';
import { loadWorkbenchTemplateUam } from '@/lib/atlas/load';
import { getSession } from '@/lib/auth';
import type { UamV1 } from '@/lib/uam/uamTypes';
import { parseScanContext, type WorkbenchSearchParams } from '@/lib/workbench/handoff';

function firstString(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

export default async function WorkbenchPage(props: { searchParams: Promise<WorkbenchSearchParams> }) {
  const searchParams = await props.searchParams;
  const session = await getSession();

  const idOrSlug =
    firstString(searchParams.id)?.trim() ??
    firstString(searchParams.slug)?.trim() ??
    firstString(searchParams.artifact)?.trim() ??
    null;

  const templateId = firstString(searchParams.templateId)?.trim() ?? null;
  const entry = firstString(searchParams.entry)?.trim() ?? null;

  let initialTemplateUam: UamV1 | null = null;
  if (!idOrSlug && templateId && templateId.length > 0) {
    try {
      initialTemplateUam = loadWorkbenchTemplateUam(templateId);
    } catch {
      initialTemplateUam = null;
    }
  }

  const initialScanContext = parseScanContext(searchParams);

  return (
    <WorkbenchPageClient
      initialArtifactId={idOrSlug}
      initialEntryHint={entry === 'translate' ? 'translate' : null}
      initialTemplateUam={initialTemplateUam}
      initialScanContext={initialScanContext}
      session={session}
    />
  );
}
