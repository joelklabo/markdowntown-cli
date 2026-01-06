# Dev Readiness Summary (Sketch Magic)

## Required Gates
1. **Dev server starts cleanly** (`pnpm dev`) with no build errors.
2. **Log review**: check foreground logs or `pnpm dev:logs`.
3. **Dev-smoke**: `pnpm dev:smoke` must pass (HTTP 200 + no build errors).
4. **DevTools QA**: run Console/Network/Performance checks.
5. **Proof video**: `pnpm proof:video` must output a `.webm` file.
6. **Quality gates**: `pnpm compile`, `pnpm lint`, `pnpm test:unit` are green.

## Log Locations
- Foreground logs: terminal output of `pnpm dev`.
- Background logs: `.logs/dev-server.log` (if using smoke or log watcher).

## Common Failure Modes
- Server-only imports leaking into client bundles.
- Missing API keys or env vars.
- Port conflicts (dev server auto-selects new port).
- Hydration mismatch or preview image errors.

## Evidence to Keep
- Proof video path in `proofs/`.
- Console + Network screenshots if issues were fixed.
