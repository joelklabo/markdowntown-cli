# Monitoring & Alerting

## Sentry
- DSNs: set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in prod/stage.
- Releases/Env: set `SENTRY_ENVIRONMENT=production` and optionally `SENTRY_RELEASE` (git SHA) via CI.
- Alerts: In Sentry, create an alert rule for project "markdowntown" -> Issue Alert -> conditions: "Number of errors is above 1 in 5 minutes"; actions: notify email/Slack.

## PostHog
- Set `NEXT_PUBLIC_POSTHOG_KEY` (and `NEXT_PUBLIC_POSTHOG_HOST` if self-hosted).
- Verify pageviews and key events in PostHog; add alerts as needed in PostHog insights.
  - UX telemetry events:
    - `ui_route_view`, `ui_shell_loaded`, `session_start` (route-level engagement + timing anchor)
    - `nav_click`, `nav_search_open`, `nav_search_submit`, `nav_search_quick_filter`
    - `ui_home_cta_click` (landing CTA hierarchy)
    - `builder_load`, `builder_save_success`, `builder_download`, `builder_copy`
    - `translate_start`, `translate_complete`, `translate_download`, `translate_open_workbench`
    - `library_action` (open_workbench, copy, download, fork)
    - `open_workbench` (entry source + time-to-open timing)
  - Onboarding funnel events (see `docs/analytics/events.md`):
    - `atlas_simulator_scan_start`, `atlas_simulator_scan_complete`, `atlas_simulator_scan_cancel`, `atlas_simulator_scan_error`
    - `atlas_simulator_simulate`, `atlas_simulator_health_check`, `atlas_simulator_health_template_copy`
    - `atlas_simulator_next_step_action`, `atlas_simulator_next_step_template_copy`, `atlas_simulator_next_step_template_error`
    - `ui_route_view` with `route=/atlas/simulator` and `route=/workbench`
    - `workbench_export_download` / `workbench_export_copy` (recommended instrumentation)
- Web vitals / RUM (set `NEXT_PUBLIC_ENABLE_RUM=true`):
  - `web_vital_lcp`, `web_vital_cls`, `web_vital_inp`, `web_vital_ttfb`, `web_vital_fcp`
  - `perf_navigation`, `perf_api`, `spa_nav` (see `docs/perf-report.md` for dashboards)

## Core flow funnel (landing → scan/library/translate → workbench → export)
Primary flow KPIs and suggested targets:
- **Landing CTA rate:** `ui_home_cta_click(cta=scan) / ui_route_view(route=/)` → target 10%+
- **Scan completion rate:** `atlas_simulator_scan_complete / atlas_simulator_scan_start` → target 70%+
- **Library open rate:** `library_action(action=open_workbench) / ui_route_view(route=/library)` → target 15%+
- **Translate workbench rate:** `translate_open_workbench / translate_complete` → target 40%+
- **Workbench entry rate:** `ui_route_view(route=/workbench) / (atlas_simulator_scan_complete or library_action(open_workbench) or translate_open_workbench)` → target 40%+
- **Export rate:** `workbench_export_download or workbench_export_copy / ui_route_view(route=/workbench)` → target 25%+
- **Median time to export:** time from entry event to export → target < 5 minutes

Suggested alert thresholds:
- **Landing CTA drop:** `< 5%` over 24h (CTA regression).
- **Scan completion drop:** `< 50%` over 24h (baseline regression).
- **Library open drop:** `< 8%` over 24h (discovery or CTA regression).
- **Translate workbench drop:** `< 25%` over 24h (CTA not visible or broken).
- **Workbench entry drop:** `< 20%` over 24h (handoff broken).
- **Export rate drop:** `< 15%` over 24h (export surface broken).
- **Time-to-export spike:** median `> 10 minutes` over 24h (performance regression).
- **Scan error spike:** `> 10%` over 1h (possible upload/permissions issue).

## Onboarding funnel (scan → build → export)
Primary flow KPIs and suggested targets:
- **Scan completion rate:** `atlas_simulator_scan_complete / atlas_simulator_scan_start` → target 70%+
- **Auto-detect adoption:** `atlas_simulator_simulate(repoSource=folder, trigger=scan) / atlas_simulator_scan_complete` → target 90%+
- **Override rate:** `atlas_simulator_simulate(repoSource=folder, trigger=manual) / atlas_simulator_scan_complete` → target < 25%
- **Workbench entry rate:** `ui_route_view(route=/workbench) / atlas_simulator_scan_complete` → target 40%+
- **Open Workbench CTA rate:** `ui_scan_next_step_click(actionId=open-workbench) / atlas_simulator_scan_complete` → target 30%+
- **Export rate:** `workbench_export_download or workbench_export_copy / ui_route_view(route=/workbench)` → target 25%+
- **Median time to export:** time from `atlas_simulator_scan_start` to export → target < 5 minutes
- **Scan error rate:** `atlas_simulator_scan_error / atlas_simulator_scan_start` → target < 5%

Suggested alert thresholds (PostHog or similar):
- **Scan completion drop:** `< 50%` over 24h (baseline regression).
- **Scan error spike:** `> 10%` over 1h (possible upload/permissions issue).
- **Workbench entry drop:** `< 20%` over 24h (handoff broken).
- **Open Workbench CTA drop:** `< 15%` over 24h (CTA not visible or broken).
- **Export rate drop:** `< 15%` over 24h (export surface broken).
- **Time-to-export spike:** median `> 10 minutes` over 24h (performance regression).

## Translate funnel (select → compile → workbench/download)
Translate KPIs and suggested targets:
- **Translate completion rate:** `translate_complete / translate_start` → target 60%+.
- **Translate error rate:** `translate_error / translate_start` → target < 5%.
- **Translate workbench rate:** `translate_open_workbench / translate_complete` → target 40%+.
- **Translate download rate:** `translate_download / translate_complete` → target 80%+ (if `translate_download` is not yet tracked, treat `translate_complete` as a proxy for now).
- **Median time to download:** time from `translate_start` to download → target < 2 minutes.

Suggested alert thresholds:
- **Translate completion drop:** `< 40%` over 24h (flow broken or confusing).
- **Translate error spike:** `> 10%` over 1h (compile/regression).
- **Translate workbench drop:** `< 25%` over 24h (CTA broken or unclear).
- **Translate download drop:** `< 60%` over 24h (download CTA broken or unclear).

## Library funnel (discover → open → export)
Library KPIs and suggested targets:
- **Library CTR:** `library_action(action=open_workbench) / ui_route_view(route=/library)` → target 15%+.
- **Preview CTR:** `library_action(action=open_workbench, source=library_preview) / ui_route_view(route=/library)` → target 5%+.
- **Export rate:** `workbench_export_download or workbench_export_copy / library_action(action=open_workbench)` → target 30%+.
- **Library error rate:** `library_action(action=error) / ui_route_view(route=/library)` → target < 2% (if errors are emitted).

Suggested alert thresholds:
- **Library CTR drop:** `< 8%` over 24h (discovery or CTA regression).
- **Export rate drop:** `< 20%` over 24h (handoff or export regression).
- **Preview CTR drop:** `< 2%` over 24h (preview not engaging or broken).

## Instruction health check KPIs
- **Health check run rate:** `atlas_simulator_health_check / atlas_simulator_simulate` → target 95%+ (feature enabled)
- **Pass rate:** share of `atlas_simulator_health_check` where `errorCount = 0` → target 50%+ (improves as guidance lands)
- **Warning rate:** share of runs with `warningCount > 0` → monitor for common misconfigurations
- **Template copy rate:** `atlas_simulator_health_template_copy / atlas_simulator_health_check` → target 15%+ for adoption

## Next steps engagement KPIs
- **Next steps usage rate:** `atlas_simulator_next_step_action / atlas_simulator_scan_complete` → target 30%+ for first-time users.
- **Docs click-through:** share of `atlas_simulator_next_step_action` where `actionId = open-docs` → target 10%+.
- **Template copy rate (Next steps):** `atlas_simulator_next_step_template_copy / atlas_simulator_next_step_action` → target 5%+.
- **Stale refresh loop:** share of `atlas_simulator_next_step_action` where `actionId = refresh-results` and `isStale = true` → alert if > 50% of actions or > 3 refreshes per scan (likely confusion).
- **Expected volumes:** 0-3 Next steps actions per scan is typical. Alert if action rate drops to ~0 for 24h (telemetry broken) or spikes above 5 per scan (looping).

Suggested alert thresholds:
- **Next steps drop:** `< 10%` actions per scan over 24h (CTA not visible or broken).
- **Stale refresh spike:** `refresh-results` with `isStale=true` `> 50%` of next-step actions over 6h (stale loop).

Build the funnel in PostHog once the export events are instrumented (see `docs/analytics/events.md`).

## Azure Monitor / Container Apps
- Logs already flow to Log Analytics workspace for env `satoshis-env-stg-west` (via ACA default).
- Quick queries:
  - Console logs: `ContainerAppConsoleLogs_CL | where ContainerAppName_s == "markdowntown-app" | limit 50`
  - System events: `ContainerAppSystemEvents_CL | where ContainerAppName_s == "markdowntown-app"`
- Suggested alerts (create in Azure Monitor):
  - Container not running / restart count spike.
  - CPU > 80% for 5m or Memory > 80% for 5m.
  - HTTP 5xx rate > 5% for 5m (via Log Analytics query on console logs).

## Health checks
- Endpoint: `https://markdown.town/api/health` returns `{status:"ok"}`. Use for uptime monitors (Pingdom/UptimeRobot/Azure availability test).

## Action items to enable alerts
1) Create Sentry issue alert as above.
2) In Azure Monitor, create metric alerts for CPU/Memory and a Log Analytics alert for 5xx.
3) Optionally set uptime monitor hitting `/api/health` every 1-5 minutes.
4) Performance: see `docs/perf-report.md` for RUM dashboards, SLOs, and Lighthouse automation (PR comments + artifacts).
