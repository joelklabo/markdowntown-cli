# Deploy & rollback runbook

## Deploy (Azure Container Apps)
1) Build & push image: `docker build -t ghcr.io/org/markdowntown:TAG . && docker push ghcr.io/org/markdowntown:TAG`
2) Update ACA: `az containerapp update --name markdowntown-app --resource-group <rg> --image ghcr.io/org/markdowntown:TAG`
3) Verify health: `curl https://markdown.town/api/health` and check logs for errors.
4) Smoke test public pages (/ /browse /builder) and auth.

## Rollback
1) Redeploy previous good image tag: `az containerapp update --image ghcr.io/org/markdowntown:PREV`
2) If feature-related, turn off flags: `public_library`, `builder_v2`, `templates_v1`, `engagement_v1`.
3) Confirm health + basic flows; watch error rate and TTFB for 10 minutes.

## Env & secrets checklist
- `DATABASE_URL`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID/SECRET`
- Observability: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Caching: ensure env matches `next.config.ts` headers; CDN honors `Cache-Control`/`CDN-Cache-Control`.

## If deploy is broken
- Scale to zero? Use ACA restart or scale back to previous revision.
- Disable ingress temporarily while rolling back to avoid bad traffic.
- Open an issue in Beads and tag `markdowntown-480` with details + trace IDs.
