# Web agent workflow

- Follow the repo-level guidance in `AGENTS.md`.
- Keep changes small, deterministic, and aligned with specs.
- For web changes, run `pnpm -C apps/web lint`, `pnpm -C apps/web compile`, and `pnpm -C apps/web test:unit`.
- For docs-only changes under `apps/web`, run `pnpm -C apps/web lint:md`.
- Commit and push once checks are green.
