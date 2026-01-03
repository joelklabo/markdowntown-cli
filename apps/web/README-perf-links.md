# Performance dashboards

Perf dashboards live in PostHog (see docs/perf-report.md for links/placeholders).

- RUM dashboard (TTFB/navigation): _add PostHog shared link_
- Core Web Vitals dashboard: _add PostHog shared link_
- API latency dashboard: _add PostHog shared link_

- CI Lighthouse artifacts: download `lh-metrics-*.csv` / `lh-summary-*.md` from the `Lighthouse Perf Budget` workflow run (mobile + desktop for `/`, `/browse`, `/builder`, `/atlas/simulator`, `/translate`, `/docs`).
- Pull requests get an automated Lighthouse summary comment.
- Local manual runs still land in `.lighthouse-reload-*` directories.
