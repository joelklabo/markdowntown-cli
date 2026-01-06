# Gh ops notes (append-only)

Use this file to capture new patterns, gotchas, and team conventions discovered during real tasks.

## Conventions
- Default branch name: main (markdowntown-cli)
- Release naming scheme: v* tags trigger Release workflow (markdowntown-cli)
- Deployment workflow names: Release (markdowntown-cli)
- CI workflow name: CI (markdowntown-cli)
- Secrets/variables ownership: Release uses GITHUB_TOKEN only (markdowntown-cli)
- klabo.world workflows: ci, contentlayer-check, dependency-review, gitleaks, pnpm audit, Refresh GitHub projects snapshot, Build, Test, and Deploy to Azure.
- klabo.world deploy triggers on push to main and workflow_dispatch; deploys to Azure Web App `klabo-world-app` (staging slot).
- markdowntown workflows: Checks & Coverage, Deploy to Azure (CD), E2E Playwright, Playwright Baseline Snapshots, Nightly Visual & Bundle Checks, Lighthouse Perf Budget, CodeQL, Atlas Update.
- markdowntown CD triggers on push to main; deploys to Azure Container Apps (satoshis-stg-west resources).
- nostrstack workflows: ✅ CI (Lint, Test & Build), 🔄 PR Automation, 🐳 Build & Push Docker Image (AMD64), 🚀 Deploy to Azure (Production), 🧪 Deploy to Azure (Staging), 🚀 Deploy API to Azure (Temp), 🚀 Deploy Gallery to Azure, Reusable Azure Deploy.
- nostrstack production deploy triggers on push to main (apps/api path) and workflow_dispatch; staging deploy is manual-only via workflow_dispatch.

## Patterns discovered
- markdowntown-cli uses GoReleaser on tag pushes; Release workflow triggers on `v*` tags and uses `goreleaser/goreleaser-action@v6`.
- klabo.world deploy uses GHCR image build and Azure Web App deploy; secrets include `TURBO_TOKEN`, `TURBO_TEAM`, `GHCR_USERNAME`, `GHCR_PAT`, `NEXTAUTH_SECRET`, `AZURE_WEBAPP_PUBLISH_PROFILE`.
- markdowntown checks/CI use `CODECOV_TOKEN`; E2E uses `CLIENT_ID_TEST`, `CLIENT_SECRET_TEST`, `TEST_USER`, `TEST_PASS`; CD uses `AZURE_CREDENTIALS`.
- nostrstack deploy workflows centralize in reusable workflow and use `AZURE_CREDENTIALS`, `ADMIN_API_KEY`, `OP_NODE_API_KEY`, `OP_NODE_WEBHOOK_SECRET`, `AZURE_LOG_ANALYTICS_ID`, `AZURE_LOG_ANALYTICS_KEY`, `GITHUB_TOKEN` (registry), plus staging variants (`*_STG`).
- nostrstack CI uses secrets `LNBITS_STG_ADMIN_KEY`, `NIP07_PROFILE_B64`, and `REAL_RELAY` to enable relay/profile test paths.
- `gh` defaults to a pager; use `GH_PAGER=cat` (or `--jq`) when scripting JSON output.
- If `GITHUB_TOKEN` is set in the environment, `gh auth refresh` will refuse to update stored credentials; unset `GITHUB_TOKEN` to refresh scopes (e.g., `read:packages`).
- `gh api` package endpoints return 403 without `read:packages` scope; use a PAT-backed login when needed.
- `GH_TOKEN`/`GITHUB_TOKEN` in the environment override stored gh auth; for fine-grained PATs prefer `GH_TOKEN`, otherwise unset to use keychain auth.
- In GitHub Actions, `gh` relies on `GH_TOKEN`; use a PAT or GitHub App token if you need to dispatch workflows that `GITHUB_TOKEN` cannot access.

## Pitfalls to avoid
- `gh run view --log` can fail or show `UNKNOWN STEP` when logs are missing; use `gh run download` as a fallback and expect slower API fetches for per-job logs.
- `gh workflow run` can return `Resource not accessible by integration` when `GITHUB_TOKEN`/`GH_TOKEN` is set; unset it or use a PAT with workflow permissions.
- For quick local retries, prefix the command with an empty token: `GITHUB_TOKEN= gh workflow run "<workflow>" -f key=value`.

## Follow-ups
- 

## 2026-01-02 notes
- `gh run list --json` does not support `htmlUrl`; use `url` for run links.
- Use `GH_PAGER=cat` (or `gh --pager cat`) to avoid JSON output opening in a pager.
- `gh run watch <run-id> --exit-status` is reliable for waiting on ci/deploy completion.
- For quick CI checks, run `GH_PAGER=cat gh run list --limit 5` to avoid the pager prompt.
