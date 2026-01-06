# bd fields and commands (local CLI v0.41.0)

## Core workflow commands
- `bd init` (repo setup)
- `bd ready`, `bd list`, `bd show` (finding + inspecting work)
- `bd update`, `bd close`, `bd reopen` (status changes)
- `bd dep add/remove/tree/cycles/relate` (dependencies)
- `bd blocked`, `bd stale`, `bd status` (health views)
- `bd sync` / `bd hooks` (git-based sync)
- `bd doctor`, `bd upgrade` (hygiene)
- `bd admin cleanup`, `bd admin compact` (size control)

## Issue fields (bd create --help)
Populate every supported field that applies to the task:
- title: positional or `--title`
- description: `--description` (or `--body-file`)
- acceptance: `--acceptance`
- design: `--design`
- estimate: `--estimate` (minutes)
- external ref: `--external-ref`
- type: `--type` (task, bug, feature, epic, chore, merge-request, molecule, gate, agent, role)
- priority: `--priority` (0-4 or P0-P4)
- labels: `--labels`
- assignee: `--assignee`
- dependencies: `--deps` (type:id or id)
- parent: `--parent`
- molecule: `--mol-type` (work, swarm, patrol)
- gating: `--waits-for`, `--waits-for-gate`
- routing: `--repo`, `--rig`
- advanced: `--id`, `--prefix`, `--ephemeral`, `--file` (batch)

## Update fields (bd update --help)
- status: `--status`
- title: `--title`
- description: `--description` or `--body-file`
- acceptance: `--acceptance`
- design: `--design`
- estimate: `--estimate`
- external ref: `--external-ref`
- notes: `--notes`
- parent: `--parent`
- type: `--type`
- priority: `--priority`
- assignee: `--assignee`
- labels: `--add-label`, `--remove-label`, `--set-labels`

## Close / reopen fields
- close: `bd close <id> --reason "..."`
- reopen: `bd reopen <id> --reason "..."`

## Hygiene tips
- Run `bd doctor` frequently; use `--fix` when safe.
- Keep issue sets small with `bd admin cleanup` / `bd admin compact`.
- Use `bd upgrade status/review/ack` to track changes.
