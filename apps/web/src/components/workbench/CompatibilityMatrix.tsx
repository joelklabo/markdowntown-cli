import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { CompatibilityFeature, CompatibilitySupport, CompatibilityTarget } from '@/lib/uam/compatibility';

type CompatibilityMatrixProps = {
  features: CompatibilityFeature[];
  targets: CompatibilityTarget[];
};

const SUPPORT_LABELS: Record<CompatibilitySupport, string> = {
  supported: 'Supported',
  lossy: 'Lossy',
  unsupported: 'Unsupported',
  unknown: 'Unknown',
};

const SUPPORT_TONES: Record<CompatibilitySupport, React.ComponentProps<typeof Badge>['tone']> = {
  supported: 'success',
  lossy: 'warning',
  unsupported: 'danger',
  unknown: 'neutral',
};

export function CompatibilityMatrix({ features, targets }: CompatibilityMatrixProps) {
  if (features.length === 0 || targets.length === 0) return null;

  return (
    <div className="overflow-x-auto" data-testid="compatibility-matrix">
      <table className="min-w-[520px] w-full border-separate border-spacing-0 text-left text-caption">
        <thead>
          <tr className="border-b border-mdt-border">
            <th className="px-mdt-3 py-mdt-2 text-caption font-semibold uppercase tracking-wide text-mdt-muted">
              Feature
            </th>
            {targets.map((target) => (
              <th
                key={target.targetId}
                className="px-mdt-3 py-mdt-2 text-caption font-semibold uppercase tracking-wide text-mdt-muted"
              >
                {target.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature.id} className="border-t border-mdt-border">
              <td className="px-mdt-3 py-mdt-2">
                <div className="text-body-sm text-mdt-text">{feature.label}</div>
                <div className="text-caption text-mdt-muted">{feature.description}</div>
              </td>
              {targets.map((target) => {
                const support = target.support[feature.id] ?? 'unknown';
                return (
                  <td key={`${target.targetId}-${feature.id}`} className="px-mdt-3 py-mdt-2">
                    <Badge tone={SUPPORT_TONES[support]}>{SUPPORT_LABELS[support]}</Badge>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
