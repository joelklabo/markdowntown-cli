# Analytics references

## Canonical docs
- `docs/analytics/events.md` (event taxonomy)
- `docs/architecture/event-tracking.md` (tracking plan)
- `docs/MONITORING.md` (funnel + alert guidance)
- `docs/ui/monitoring.md` (UI monitoring checklist)

## Implementation entry points
- `src/lib/analytics.ts` (track wrappers)
- `src/providers/PosthogProvider.tsx` + `src/providers/PosthogProviderLazy.tsx`
- `src/app/layout.tsx` (provider wiring)

## Common event sources
- Workbench: `src/components/workbench/*`
- Atlas Simulator: `src/components/atlas/ContextSimulator.tsx`
- Browse + Library: `src/components/browse/*`, `src/components/library/*`
