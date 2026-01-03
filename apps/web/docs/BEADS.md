# Beads workflow (bd CLI)

- List issues: `bd list`
- Filter: `bd list -p P1 -s open`
- Create: `bd create -p P2 -t task "My task"`
- Create under an epic: `bd create --parent <epic-id> -p P2 -t task "My task"`
- Close: `bd close <id> --reason "done"`
- Add dependency: `bd dep add <child> <parent> --type parent-child`
- Keep epics out of `bd ready` while children are open: `node scripts/bd-sync-epic-readiness.mjs`
- Validate beads JSONL: `pnpm bd:validate`
- Sync: beads are git-tracked in `.beads`; commit changes with code.
