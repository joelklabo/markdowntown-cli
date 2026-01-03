# Codex skills rollout runbook

## Goal
Install the markdowntown Codex skills into `~/.codex/skills` and verify that Codex CLI discovers them.

## Preconditions
- Repo checked out and dependencies installed.
- Codex CLI installed and running locally.

## Install steps
1. Validate skill metadata:
   - `node scripts/codex/validate-skills.mjs`
2. Sync skills into the user scope:
   - `scripts/codex/sync-skills.sh --verbose`
3. Confirm the skills folder now contains markdowntown entries:
   - `ls ~/.codex/skills | rg markdowntown`

## Verification
1. Open Codex CLI and run `/skills`.
2. Confirm the following skills appear:
   - markdowntown-bd
   - markdowntown-frontend
   - markdowntown-atlas-scan
   - markdowntown-workbench
   - markdowntown-testing
   - markdowntown-docs
   - markdowntown-analytics
3. Run the trigger prompts listed in `docs/testing/codex-skills-checklist.md` and confirm the correct skill activates.

## If skills do not appear
- Restart the Codex CLI session (skills can be cached across sessions).
- Re-run the sync script and confirm the destination directory updates.
- Check `scripts/codex/sync-skills.sh --dry-run` output for missing files.

## Rollback
- Remove the synced skills folder from `~/.codex/skills/markdowntown-*` if needed.

## Follow-ups
- Log any missing skills or failed activations as bd issues and link to the failing command output.
