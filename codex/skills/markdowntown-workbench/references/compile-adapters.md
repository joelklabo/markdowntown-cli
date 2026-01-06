# Compile + adapter pipeline references

## Compile entry points
- `src/components/workbench/ExportPanel.tsx` calls `/api/compile` and renders results.
- `src/app/api/compile/route.ts` validates payload + rate limits.
- `src/lib/compile/compile.ts` runs adapter registry and aggregates warnings.

## Adapter registry
- `src/lib/adapters/index.ts` (adapter registry + resolve by target/version).
- `src/lib/adapters/*` (agents-md, github-copilot, claude-code, gemini-cli, cursor, windsurf).

## UAM v1 helpers
- `src/lib/uam/uamTypes.ts` (`createUamTargetV1`, `normalizeUamTargetsV1`, target shape)
- `src/lib/uam/uamValidate.ts` (schema validation)

## Export behavior docs
- `docs/architecture/skills-export-matrix.md` (skill export per adapter)
- `docs/architecture/skills-section.md` (targets + options)

## Common checks
- Ensure target IDs resolve via the adapter registry.
- Surface file path collisions in compile warnings.
- Keep adapter labels/version metadata accurate for UI display.
