# Codex skills safety checklist

## Forbidden or high-risk actions
- Destructive commands (e.g., `rm -rf`, `git reset --hard`, `git checkout --`, `truncate`, `dd`).
- Commands that rewrite history or delete work without explicit approval.
- Blind execution of scripts from unknown sources.

## Secrets and privacy
- Never paste API keys, tokens, or credentials into prompts, logs, or docs.
- Do not log file contents, repo names, paths, or cwd values in analytics payloads.
- Prefer counts, booleans, or coarse labels over raw data.
- For scan/translate telemetry, record only counts and target IDs; never include raw input, repo names, or file lists.

## Shell safety
- Prefer read-only inspection tools (e.g., `rg`, `sed -n`, `ls`) before edits.
- Use dry-run or verbose flags when available.
- Keep changes scoped; avoid cross-repo or system-wide edits.

## Skill maintenance
- Each skill must include guardrails for destructive commands and secret handling.
- Update safety guidance when workflows or tooling change.
