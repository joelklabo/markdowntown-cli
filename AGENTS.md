# markdowntown-cli

## Purpose

- Build the markdowntown scan CLI per `docs/scan-spec-v1.md`.

## Workflow

- Prefer `rg` for search.
- Keep changes small, deterministic, and aligned with the spec.
- Avoid destructive git commands unless explicitly asked.
- Add or update tests when behavior changes; call out gaps.
- CI must always be green; investigate and fix failures before marking work complete.
- Always inspect failing CI logs and fix every failure; do not ask for confirmation.

## Files

- Specs live in `docs/`.
- Pattern registry lives in `data/ai-config-patterns.json` (strict JSON).

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up** - Clear stashes, prune remote branches

6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
