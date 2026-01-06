# GitHub CLI command map (task -> command)

## Context & auth
- `scripts/ghx <cmd>` (wrapper that logs outcomes; prefer for all gh commands)
- `GH_TOKEN=<pat> gh <cmd>` (explicit token; useful in CI or when stored auth is unavailable)
- `gh auth status`
- `gh auth login` (interactive)
- `gh auth login --with-token` (stdin token; useful for PATs in CI)
- `gh auth refresh -h <host> -s <scope>` (refresh scopes)
- `gh repo view` (inside a repo)
- `gh status`
- `GH_PAGER=cat gh <cmd>` (disable pager for scripting)

## Workflows & runs
- `gh workflow list`
- `gh workflow view <name|id>`
- `gh workflow run <name|id> --ref <ref> -f key=value` (use `-F` for @file or JSON input patterns)
- `gh run list`
- `gh run view <run-id>`
- `gh run view <run-id> --log` (all logs) / `--log-failed` (failed only)
- `gh run watch <run-id>`
- `gh run rerun <run-id>` (add `--failed` to rerun only failed jobs)
- `gh run download <run-id>`

## Troubleshooting 403 integration errors
- `env -u GITHUB_TOKEN -u GH_TOKEN gh workflow run <name|id> --ref <ref>` (bypass integration token)
- `GITHUB_TOKEN= gh workflow run <name|id> --ref <ref>` (clear token for one command)
- `unset GITHUB_TOKEN GH_TOKEN` (remove integration tokens from the shell)

## Secrets & variables
- `gh secret list`
- `gh secret set NAME` (reads from stdin; use `--body` for inline)
- `gh secret remove NAME`
- `gh variable list`
- `gh variable set NAME` (reads from stdin; use `--body` for inline)
- `gh variable remove NAME`
- Use scope flags for org/user/environment secrets or variables. Confirm flags via `gh secret set --help` and `gh variable set --help`.

## Environments & deploys
- `gh secret set NAME -e <env>` (environment-scoped secret)
- `gh variable set NAME -e <env>` (environment-scoped variable)
- `gh api repos/<owner>/<repo>/deployments --paginate` (deployment history)

## Releases
- `gh release list`
- `gh release view <tag>`
- `gh release create <tag> <files...>` (use `--generate-notes` when appropriate)
- `gh release upload <tag> <files...>`
- `gh release download <tag>`
- `gh release delete <tag>`

## PRs / issues
- `gh pr list/view/create/checkout/merge`
- `gh issue list/view/create/close`

## Repo admin
- `gh repo clone <owner/name>`
- `gh repo fork`
- `gh repo sync` (mirror default branch)
- `gh repo edit` (settings)
- `gh label list/create/edit/delete`

## API & JSON
- `gh api <endpoint>`
- `gh api <endpoint> --paginate`
- `gh <cmd> --json <fields> --jq '<filter>'`
- `gh help formatting` (JSON, jq, and template output helpers)

## Git (pairing)
- `git status -sb`
- `git switch -c <branch>`
- `git commit -am "msg"`
- `git push -u origin <branch>`
