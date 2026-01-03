# Codex skills discovery + smoke checklist

## Pre-flight
- [ ] Run `node scripts/codex/validate-skills.mjs`.
- [ ] Sync skills: `scripts/codex/sync-skills.sh --verbose`.
- [ ] Restart Codex CLI session if skills are cached.

## /skills discovery
- [ ] Run `/skills` and confirm markdowntown skills appear:
  - markdowntown-bd
  - markdowntown-frontend
  - markdowntown-atlas-scan
  - markdowntown-workbench
  - markdowntown-testing
  - markdowntown-docs
  - markdowntown-analytics

## Trigger prompts (examples)
- [ ] "bd workflow" → markdowntown-bd
- [ ] "scan flow" or "atlas simulator" → markdowntown-atlas-scan
- [ ] "workbench export" → markdowntown-workbench
- [ ] "run tests" or "playwright" → markdowntown-testing
- [ ] "update docs" or "UX spec" → markdowntown-docs
- [ ] "analytics redaction" → markdowntown-analytics
- [ ] "design system" or "layout" → markdowntown-frontend

## Rollout verification
- [ ] Follow `docs/runbooks/codex-skills-rollout.md` install steps.
- [ ] Confirm `~/.codex/skills` contains the synced markdowntown folders.
- [ ] Reload Codex CLI and re-run `/skills` if newly synced skills are missing.

## Notes
- Log any missing skills or misfires as follow-up bd issues.
