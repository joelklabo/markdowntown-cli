# Performance reporting

## Where to see the data
- **PostHog dashboards** (create + link here):
  - RUM: `perf_navigation` (TTFB, DOMContentLoaded, load, transfer sizes) filtered by path
  - Web vitals: `web_vital_lcp`, `web_vital_cls`, `web_vital_inp`
  - API latency: `perf_api` duration/ttfb by endpoint + cache hint
- **Lighthouse artifacts**: CI workflow uploads `lh-metrics-<slug>-<form_factor>.csv` and `lh-summary-...md` per run (see .github/workflows/lighthouse.yml). Local manual runs still live at `.lighthouse-reload-2025-12-01/`.

### RUM dashboards (PostHog)
- Dashboard **RUM - Navigation & TTFB** – p75 of `perf_navigation.ttfb` by path + connection type. _(replace with shared link once created)_
- Dashboard **Core Web Vitals** – p75 of `web_vital_lcp`, `web_vital_cls`, `web_vital_inp` grouped by path. _(replace with link)_
- Dashboard **API latency** – sampled `perf_api` duration/ttfb grouped by endpoint/cache. _(replace with link)_
- Backend/API latency: chart `perf_api` duration/ttfb p50/p95 and error rate; alert if p95 > 1200ms or error rate > 1% for 10m.
Add shared URLs to README-perf-links.md once published.

## Event schema (client)
- `perf_navigation`: { path, ttfb, domContentLoaded, loadEvent, transferSize, encodedBodySize, decodedBodySize, cache? }
- `web_vital_lcp`: { path, value }
- `web_vital_cls`: { path, value }
- `web_vital_fcp`, `web_vital_inp`, `web_vital_ttfb`: include path + device/connection hints.
- `spa_nav`: { path, duration } captures soft navigations after route change.
- `perf_api`: sampled fetch/XHR timings with ttfb/duration + cache/server-timing hints.

## Route SLOs (p75 targets)

| Route | Form factor | LCP | TTFB | INP | CLS |
| --- | --- | --- | --- | --- | --- |
| / | mobile | ≤ 3.5s | ≤ 1200ms | ≤ 200ms | ≤ 0.10 |
| / | desktop | ≤ 2.5s | ≤ 800ms | ≤ 150ms | ≤ 0.05 |
| /browse | mobile | ≤ 4.0s | ≤ 1200ms | ≤ 200ms | ≤ 0.10 |
| /browse | desktop | ≤ 3.0s | ≤ 900ms | ≤ 150ms | ≤ 0.07 |
| /builder | mobile | ≤ 4.2s | ≤ 1200ms | ≤ 220ms | ≤ 0.10 |
| /builder | desktop | ≤ 3.4s | ≤ 900ms | ≤ 180ms | ≤ 0.07 |

Lighthouse CI also covers `/atlas/simulator`, `/translate`, and `/docs` as of 2025-12-19; add SLO targets once the baselines stabilize.


## CI Lighthouse automation
- Workflow: `.github/workflows/lighthouse.yml` runs desktop+mobile Lighthouse on `/`, `/browse`, `/builder`, `/atlas/simulator`, `/translate`, `/docs`.
- Each matrix run uploads `lh-metrics-<slug>-<form_factor>.csv` and `lh-summary-...md` artifacts with perf, LCP, TTI, TTFB, CLS; combined `lh-trends` artifact aggregates all rows for the run.
- On pull requests a bot comment summarizes the latest run across all URLs/form factors.
- Artifacts retained for 30 days; download per run to maintain a longer-lived trend spreadsheet if needed.

## Next steps
- Publish dashboard links in this file once created (markdowntown-l3p.1).
- Automate Lighthouse trend capture and link artifacts (markdowntown-l3p.2).
- Add alerts:
  - PostHog insight on `perf_navigation` TTFB p75 per path (/ and /browse) with alert when > 1200ms for 15 minutes.
  - Cache hit ratio: use `perf_navigation.cache` or `perf_api.cache` fields; alert if HIT ratio < 0.8 for 10 minutes.
  - Web vitals: INP p75 > 200ms or LCP p75 > 4000ms sustained for 15 minutes.
