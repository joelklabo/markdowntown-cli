# Beads quick reference

## Common commands
- List: `npx bd --no-daemon list --json`
- Ready: `npx bd --no-daemon ready --json`
- Show: `npx bd --no-daemon show <id> --json`
- Update: `npx bd --no-daemon update <id> --status in_progress --json`
- Close: `npx bd --no-daemon close <id> --reason "Implemented" --json`
- Dep add: `npx bd --no-daemon dep add <child> <parent> --type blocks --json`

## Hygiene
- Reset stale issues: `node scripts/bd-reset-stale.mjs --hours 4`
- Sync at session end: `npx bd --no-daemon sync`
- Commit `.beads/issues.jsonl` with work
