'use client';

import React, { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { trackLibraryAction } from '@/lib/analytics';

export type ForkButtonProps = {
  artifactId: string;
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  analytics?: {
    source?: string;
    title?: string;
    slug?: string;
  };
};

export function ForkButton({
  artifactId,
  label = 'Fork / Edit',
  variant = 'secondary',
  size = 'md',
  className,
  analytics,
}: ForkButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleFork = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/artifacts/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactId }),
      });

      if (res.status === 401) {
        setLoading(false);
        router.push('/signin');
        return;
      }

      if (!res.ok) throw new Error('Fork failed');
      
      const data = await res.json();
      trackLibraryAction({
        action: 'fork',
        id: artifactId,
        title: analytics?.title,
        slug: analytics?.slug,
        source: analytics?.source ?? 'artifact_fork',
      });
      router.push(`/workbench?id=${data.id}`);
    } catch (error) {
      console.error(error);
      alert('Failed to fork artifact. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Button className={className} variant={variant} size={size} onClick={handleFork} disabled={loading}>
      {loading ? 'Forking...' : label}
    </Button>
  );
}
