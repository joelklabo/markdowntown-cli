# UI Monitoring Runbook

Date: 2025-12-26
Scope: UI telemetry, error signals, and performance metrics for public release.

## Where to look
- PostHog events (production) when `NEXT_PUBLIC_POSTHOG_KEY` is set.
- Console output (dev) when PostHog is disabled.
- Browser DevTools Performance panel for local regressions.

## Core UI telemetry events
- `ui_route_view`: page views with path/referrer/viewport context.
- `ui_shell_loaded`: first shell render per session.
- `session_start`: session timing anchor used for time-to-* metrics.
- `ui_header_ready`: header render metrics (`status`, `bannerHeight`, `navHeight`, `elapsedMs`, `hasWordmark`).
- `ui_theme_change`: theme toggles (`theme`, `previous`).
- `ui_density_change`: density toggles (`density`, `previous`).
- `ui_command_palette_open`: command palette entry (`origin`).
- `ui_home_cta_click`: home CTA clicks (`cta`, `slot`, `placement`, `href`).
- `ui_scan_start`: scan funnel entry (`method`, `tool`).
- `ui_scan_complete`: scan funnel completion (`method`, `tool`, `totalFiles`, `matchedFiles`, `truncated`).
- `ui_scan_results_cta`: results CTA clicks (`source`, `tool`, `repoSource`, `loaded`, `missing`, `truncated`, `fileCount`). Sources include `next_steps` (primary Open Workbench CTA), `actions`, and `post_scan`.
- `ui_scan_next_step_click`: Next steps CTA clicks (`actionId`, `stepId`, `tool`, `repoSource`, `isStale`, `fileCount`, `truncated`, `source`=`next_steps`).
- `translate_start`: translate funnel entry (`targetIds`, `targetCount`, `inputChars`, `detectedLabel`).
- `translate_complete`: translate completion (`targetIds`, `targetCount`, `inputChars`, `fileCount`).
- `translate_download`: translate downloads (`targetIds`, `targetCount`, `fileCount`, `byteSize`).
- `translate_error`: translate failures (`targetIds`, `targetCount`, `inputChars`, `detectedLabel`, `reason`).
- `library_action`: library CTA clicks (`action`, `id`, `source`, `targetIds`).

## Critical action events (track)
These are emitted by specific surfaces and should be reviewed by feature area:
- Navigation: `nav_click`, `nav_search_submit`, `nav_search_suggestion_click`.
- Atlas Simulator: `atlas_simulator_scan_start`, `atlas_simulator_scan_complete`, `atlas_simulator_next_step_action`.
- Workbench: `open_workbench` (includes `entrySource`, optional `time_to_open_workbench_ms`), `workbench_export_download`, `workbench_export_copy`, `workbench_save_artifact` (export events include `entrySource`, optional `time_to_export_ms`).
- Library: `library_action`.
- Translate: `translate_download`.
- Builder/Browse/Templates/Snippets: `builder_copy`, `browse_card_use_template`, `template_use_builder`, etc.

## Error monitoring
- `atlas_simulator_scan_error`, `atlas_simulator_download_error`, `atlas_simulator_view_report_error`.
- `translate_error`.
- `wordmark_banner_error`.
- Any `*_failed` events (e.g., `builder_save_failed`, `workbench_save_artifact_failed`).

## Performance monitoring
Events emitted by `PerfVitals`:
- Web vitals: `web_vital_lcp`, `web_vital_cls`, `web_vital_inp`, `web_vital_fcp`, `web_vital_ttfb`.
- Navigation timing: `perf_navigation`.
- SPA timing: `spa_nav`.
- API sampling: `perf_api`.
- Budget alerts: `perf_budget_violation`.

## Triage checklist
- Compare `ui_route_view` vs `ui_shell_loaded` counts; large gaps suggest boot issues.
- Review `ui_theme_change` and `ui_density_change` spikes after UI releases.
- Filter errors by route to identify failing surface.
- Check `perf_budget_violation` events for LCP/CLS regressions.

## Scan funnel targets
- Scan completion rate (`atlas_simulator_scan_complete / atlas_simulator_scan_start`): target 70%+.
- Open Workbench CTA rate (`ui_scan_next_step_click` where `actionId=open-workbench`): target 30%+.
- Workbench entry rate (`ui_route_view` with `/workbench`): target 40%+.
- Export rate (`workbench_export_download` or `workbench_export_copy`): target 25%+.

## Translate funnel targets
- Translate completion rate (`translate_complete / translate_start`): target 60%+.
- Translate error rate (`translate_error / translate_start`): target < 5%.
- Translate download rate (`translate_download / translate_complete`): target 80%+.

## Library funnel targets
- Library CTR (`library_action` with `action=open_workbench` / `ui_route_view` for `/library`): target 15%+.
- Preview CTR (`library_action` with `action=open_workbench` and `source=library_preview` / `ui_route_view` for `/library`): target 5%+.
- Export rate (`workbench_export_download` or `workbench_export_copy` / `library_action` open_workbench): target 30%+.

## Escalation guidance
- P0: sustained `perf_budget_violation` spikes on `/` or `/atlas/simulator`.
- P1: repeated `atlas_simulator_scan_error` or `workbench_export_*` failures.
- P2: intermittent theme/density toggling issues or minor nav search errors.
