# Perf runbook

## Check live health
- RUM dashboards (PostHog): see links in `docs/perf-report.md` (Navigation/TTFB, Core Web Vitals, API latency).
- Server-Timing headers: `x-trace-id`, `Server-Timing: app, cache, total` on public APIs/pages.
- CI Lighthouse: `Lighthouse Perf Budget` workflow uploads `lh-metrics-*.csv` and comments on PRs (routes `/`, `/browse`, `/builder`, `/atlas/simulator`, `/translate`, `/docs`).

## Quick tests
- Local throttled Lighthouse: `pnpm exec bash scripts/lighthouse-baseline.sh .lighthouse-local`
- Budgets: `pnpm exec lighthouse https://markdown.town --budget-path lighthouse-budget.json`
- Bundle sizes: `pnpm analyze`

## When perf degrades
1) Grab latest CI `lh-trends` artifact; compare against SLOs in `docs/perf-report.md`.
2) Check PostHog dashboards for spikes in TTFB/LCP/INP and cache misses.
3) Use trace ID from failing request header to search logs/console output.
4) If CDN hit rate drops, verify cache headers (`cache-intent=bypass`) and revalidate tags are firing.
5) Roll back recent deploy or toggle feature flags (`public_library`, `builder_v2`, `templates_v1`, `engagement_v1`) if needed.

## After mitigation
- Capture before/after Lighthouse and attach to the relevant issue.
- Update budgets/SLO docs if thresholds change.
