'use client';

import { useEffect, useMemo } from 'react';
import { trackSkillsListView } from '@/lib/analytics';

type SkillsListTrackerProps = {
  count: number;
  q: string;
  tags: string[];
  targets: string[];
  sort: string;
};

export function SkillsListTracker({ count, q, tags, targets, sort }: SkillsListTrackerProps) {
  const signature = useMemo(() => {
    return JSON.stringify({ count, q, tags, targets, sort });
  }, [count, q, sort, tags, targets]);

  useEffect(() => {
    trackSkillsListView({
      count,
      q: q.length > 0 ? q : undefined,
      tags: tags.length > 0 ? tags : undefined,
      targets: targets.length > 0 ? targets : undefined,
      sort,
    });
  }, [signature, count, q, sort, tags, targets]);

  return null;
}
