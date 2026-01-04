# Codex CLI slash commands

## /skills
- Lists installed skills discovered by Codex CLI.
- Use after syncing skills into `~/.codex/skills`.
- Expected markdowntown skills include: markdowntown-bd, markdowntown-docs, markdowntown-testing, markdowntown-frontend, markdowntown-backend, markdowntown-workbench, markdowntown-atlas-scan, markdowntown-analytics.

## Workflow notes
- If `/skills` is missing entries, restart the Codex CLI session.
- Sync skills with `scripts/codex/sync-skills.sh --verbose` (see `apps/web/docs/runbooks/codex-skills-rollout.md`).
- Source of truth lives in `codex/skills/`; runtime copies live in `.codex/skills/` or `~/.codex/skills/`.
- Log missing skills or misfires as bd issues.

## References
- `apps/web/docs/runbooks/codex-skills-rollout.md`
- `apps/web/docs/testing/codex-skills-checklist.md`
