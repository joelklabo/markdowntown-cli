# Docs Refresh Runbook

## Purpose
- Refresh `doc-sources.json` (registry) and `doc-inventory.json` (inventory) on a schedule.
- Enforce fail-stale semantics: if a refresh fails, continue serving the last-good snapshot from the doc store.

## Inputs
- `DOC_REGISTRY_URL` / `DOC_REGISTRY_PATH`: fetch location for the source registry (defaults to `cli/data/doc-sources.json` if present).
- `DOC_INVENTORY_URL` / `DOC_INVENTORY_PATH`: fetch location for the doc inventory (defaults to `docs/doc-inventory.json` if present).
- `DOC_STORE_PATH`: optional override for the snapshot cache (default: `.cache/docs`).

## Manual refresh
```bash
# From repo root
pnpm dlx tsx scripts/docs/refresh.ts
# Or hit the API route (assumes web app running)
curl -X POST https://<host>/api/docs/refresh
```
Exit code is non-zero only when there is no usable last-good snapshot (`hasHardFailure`).

## Scheduled job
- Module: `infra/modules/jobs-doc-refresh.bicep`
- Trigger: cron (`cronExpression`, default every 6 hours)
- Container image: reuse worker/web image with `scripts/docs/refresh.ts` available
- Set environment variables above plus any auth required to reach the registry/inventory URLs.
- Recommended command: `pnpm dlx tsx scripts/docs/refresh.ts` (or equivalent entrypoint) inside the job container.

## Observability and alerts
- Inspect ACA Job runs for the `docs-refresh` job; failures surface in job run status and container logs.
- Alerting: create an Azure Monitor alert on job run failures (signal: `ContainerAppJobFailed`/`ContainerAppJobStopped`) and on log search for `hasHardFailure` or non-zero exit codes.
- Keep a dashboard panel for:
  - Last successful refresh timestamp (from `last-good.json`)
  - Number of consecutive failures
  - Job duration

## Fail-stale behavior
- Successful refresh writes `.cache/docs/<kind>/last-good.json` with the validated content and checksum.
- If a refresh attempt fails, API consumers receive the last-good snapshot; only a missing last-good triggers a hard failure/alert.

## Troubleshooting
- Validate inputs locally with `pnpm dlx tsx scripts/docs/refresh.ts` (export env vars first).
- Check container logs for `Fetch failed` or validation errors (duplicate IDs, non-HTTPS URLs, oversized payloads).
- Validate local files: `node -e "JSON.parse(require('fs').readFileSync('docs/doc-inventory.json','utf8'))"`.
- If the doc store is corrupted, delete `.cache/docs/<kind>` and rerun the refresh to rebuild from sources.
