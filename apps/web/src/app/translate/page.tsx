import { TranslatePageClient } from '@/components/translate/TranslatePageClient';
import { loadExampleText } from '@/lib/atlas/load';
import { createUamTargetV1 } from '@/lib/uam/uamTypes';

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = 'force-dynamic';

function firstString(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

export default async function TranslatePage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const target = firstString(searchParams.target)?.trim() ?? null;
  const example = firstString(searchParams.example)?.trim() ?? null;

  const initialTargetIds = target && target.length > 0 ? [target] : ['agents-md', 'github-copilot'];
  const initialTargets = initialTargetIds.map((targetId) => createUamTargetV1(targetId));

  let initialInput = '';
  let initialError: string | null = null;

  if (example && example.length > 0) {
    try {
      initialInput = loadExampleText(example);
    } catch {
      initialError = `Example not found: ${example}`;
    }
  }

  return (
    <TranslatePageClient initialInput={initialInput} initialTargets={initialTargets} initialError={initialError} />
  );
}
