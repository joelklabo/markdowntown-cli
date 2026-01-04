# markdowntown CLI

## Purpose
- Build the scan/audit CLI per `cli/docs/scan-spec-v1.md` and `cli/docs/audit-spec-v1.md`.
- Maintain stable output schemas and deterministic ordering.

## Workflow
- Prefer `rg` for search.
- Keep changes small and aligned with the specs.
- Run `make lint` and `make test` from the `cli/` directory.
- Update or add Go tests when behavior changes.
- Follow CLI model notes in `cli/CLAUDE.md` and `cli/GEMINI.md` when using those tools.

## Files
- Specs: `cli/docs/`.
- Pattern registry: `cli/data/ai-config-patterns.json` (strict JSON).
- CLI entrypoint: `cli/cmd/markdowntown/main.go`.
- Sync/auth logic: `cli/internal/auth/*`, `cli/internal/sync/*`.

## Notes
- For web app changes, follow `apps/web/AGENTS.md`.
- For repo-wide workflow, see root `AGENTS.md`.
