# Codex skills overview

## Available skills
- **markdowntown-bd** — bd workflow, git hygiene, test loop.
- **markdowntown-frontend** — UI, layout, design system constraints.
- **markdowntown-atlas-scan** — scan + simulator flow and handoff.
- **markdowntown-workbench** — Workbench state, export/compile pipeline.
- **markdowntown-backend** — API routes, Prisma, server-side validation.
- **markdowntown-testing** — test commands, E2E + Playwright guidance.
- **markdowntown-docs** — docs locations, terminology, content style.
- **markdowntown-analytics** — event tracking, privacy, redaction rules.

## Source locations
- Skill sources live in `codex/skills/<skill-name>/`.
- Installed skills sync to `~/.codex/skills/<skill-name>/`.

## Maintenance workflow
1. Initialize a new skill: `scripts/codex/init-skill.sh <skill-name> [resources]`.
2. Update `codex/skills/<skill>/SKILL.md` or references.
3. Validate: `node scripts/codex/validate-skills.mjs`.
4. Sync: `scripts/codex/sync-skills.sh --verbose`.
5. Re-run Codex CLI if needed to reload skills.

Note: this repo uses `scripts/codex/init-skill.sh` instead of the `init_skill.py` helper referenced in generic Codex guidance.
