# Analytics event taxonomy

This file defines canonical event names and properties for the UX and onboarding funnel.

## Naming conventions
- Use `snake_case`.
- Prefer stable prefixes: `ui_*`, `atlas_simulator_*`, `workbench_*`, `nav_*`.
- Keep properties small, numeric where possible.

## Core UX events (implemented)
- `ui_route_view` — fired on route change.
  - Properties: `route`
- `ui_shell_loaded` — fired once per session.
  - Properties: `route`
- `session_start` — session start marker used for timing metrics.
  - Properties: none
- `nav_click` — navigation clicks.
  - Properties: `href`, `placement`, optional `cta`
- `ui_home_cta_click` — home page CTA clicks.
  - Properties: `cta` (`scan` | `workbench` | `library`), `slot` (`primary` | `secondary` | `tertiary` | `single`),
    `placement` (`hero` | `proof` | `build-steps` | `library-preview` | `final-cta` | `empty-state`), `href`
- `ui_scan_start`
  - Properties: `method` (`directory_picker` | `file_input`), `tool`
- `ui_scan_complete`
  - Properties: `method`, `tool`, `totalFiles`, `matchedFiles`, `truncated`
- `ui_scan_results_cta`
  - Properties: `source` (`next_steps` | `actions` | `post_scan`), `tool`, `repoSource`, `loaded`, `missing`
- `ui_scan_next_step_click`
  - Properties: `actionId`, `stepId`, `tool`, `repoSource`, `isStale`, `fileCount`, `source` (`next_steps`)
- `translate_start`
  - Properties: `targetIds`, `targetCount`, `inputChars`, `detectedLabel`
- `translate_complete`
  - Properties: `targetIds`, `targetCount`, `inputChars`, `fileCount`, `warningCount`, `infoCount`
- `translate_download`
  - Properties: `targetIds`, `targetCount`, `fileCount`, `byteSize`
- `translate_open_workbench`
  - Properties: `targetIds`, `targetCount`, `fileCount`
- `translate_error`
  - Properties: `targetIds`, `targetCount`, `inputChars`, `detectedLabel`, optional `reason`, plus error `message`
- `library_action`
  - Properties: `action` (`open_workbench` | `copy` | `download` | `fork`), `id`, optional `slug`, `title`, `source`, `targetIds`

## Onboarding funnel events

### Atlas Simulator (implemented)
- `atlas_simulator_scan_start`
  - Properties: `method` (`directory_picker` | `file_input`), `tool`, `cwd`
  - Notes: Represents the user initiating the upload/scan action.
- `atlas_simulator_scan_complete`
  - Properties: `method`, `tool`, `cwd`, `totalFiles`, `matchedFiles`, `truncated`, `rootName`
  - Notes: `rootName` is redacted in analytics payloads; use file counts for volume tracking.
- `atlas_simulator_scan_cancel`
  - Properties: `method`, `tool`, `cwd`
- `atlas_simulator_scan_error`
  - Properties: `method`, `tool`, `cwd`, `errorName`
- `atlas_simulator_simulate`
  - Properties: `tool`, `repoSource`, `trigger`, `cwd`, `fileCount`
- `atlas_simulator_health_check`
  - Properties: `tool`, `repoSource`, `trigger`, `cwd`, `fileCount`, `issueCount`, `errorCount`, `warningCount`, `infoCount`
- `atlas_simulator_health_template_copy`
  - Properties: `tool`, `code`, `templateId`, `templatePath`
- `atlas_simulator_next_step_action`
  - Properties: `tool`, `repoSource`, `cwd`, `actionId`, `stepId`, `isStale`, `fileCount`
  - Action IDs:
    - `open-workbench` (primary CTA when Ready state is shown)
    - `open-docs`
    - `refresh-results`
    - `scan-folder`
    - `scan-smaller-folder`
    - `paste-paths`
    - `set-cwd`
    - `switch-tool`
    - `review-extra-files`
    - `copy-summary`
    - `download-report`
    - `copy-template`
    - `copy-base-template`
- `atlas_simulator_report_inaccuracy`
  - Properties: `tool`, `repoSource`, `fileCount`, `missingCount`, `warningCount`, `shadowedCount`, `truncated`
- `atlas_simulator_next_step_template_copy`
  - Properties: `tool`, `repoSource`, `templateId`, `templatePath`, `actionId`, `stepId`
- `atlas_simulator_next_step_template_error`
  - Properties: `tool`, `repoSource`, `templateId`, `templatePath`, `message` (from error tracking)

#### Quick upload signals (derived)
- **Auto-detect choice:** `atlas_simulator_simulate` where `repoSource=folder` and `trigger=scan`. Use the `tool`/`cwd`
  values as the detected choice.
- **Manual overrides:** subsequent `atlas_simulator_simulate` events where `repoSource=folder` and `trigger=manual`.
- **Upload completion:** `atlas_simulator_scan_complete` relative to `atlas_simulator_scan_start`.

### Workbench (implemented)
- `ui_route_view` with `route=/workbench` — use as the entry signal.
- `open_workbench`
  - Properties: `entrySource` (`scan` | `library` | `translate` | `direct`), optional `time_to_open_workbench_ms`
- `workbench_save_artifact`
  - Properties: `id`
- `workbench_export_download`
  - Properties: `targetIds`, `fileCount`, `entrySource`, optional `time_to_export_ms`
- `workbench_export_copy`
  - Properties: `path`, `targetId`, `entrySource`

## Funnel definition (scan → build → export)
1. `atlas_simulator_scan_start`
2. `atlas_simulator_scan_complete`
3. `ui_route_view` (`route=/workbench`)
4. `workbench_export_download` or `workbench_export_copy`
