'use client';

import { useEffect, useMemo } from 'react';
import { trackSkillDetailView } from '@/lib/analytics';

type SkillDetailTrackerProps = {
  id: string;
  slug?: string;
  title?: string;
  targets: string[];
  capabilityCount: number;
};

export function SkillDetailTracker({ id, slug, title, targets, capabilityCount }: SkillDetailTrackerProps) {
  const signature = useMemo(() => {
    return JSON.stringify({ id, slug, title, targets, capabilityCount });
  }, [id, slug, title, targets, capabilityCount]);

  useEffect(() => {
    trackSkillDetailView({
      id,
      slug,
      title,
      targets,
      capabilityCount,
    });
  }, [signature, id, slug, title, targets, capabilityCount]);

  return null;
}
