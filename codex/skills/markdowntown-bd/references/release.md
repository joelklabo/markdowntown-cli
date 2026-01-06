# Repo ops + release notes

## Required checks
- `npm run compile`
- `npm run lint`
- `npm run test:unit`

## Commit + push
- Use task id in commit subject: `<id>: <title>`
- Include a short description and file list
- Push to `origin main` after each completed task

## Safety
- Do not amend commits unless explicitly requested.
- Avoid `git reset --hard` or other destructive commands.
