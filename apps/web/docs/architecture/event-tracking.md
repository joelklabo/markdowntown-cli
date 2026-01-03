# Event Tracking & Analytics Plan
Date: 2025-12-01
Epic: markdowntown-7z8

## Goals
- Measure engagement on public content and funnel to signup/save.
- Keep implementation lightweight (PostHog already available).

## Core events
- `content_copy` (properties: target_type, target_id, target_slug, source=snippet|template|document|builder, visibility, tags, user_authenticated)
- `content_download` (same props + file_format)
- `add_to_builder` (target_type/id, source=list|detail)
- `builder_export` (count snippets, has_template, exported_length)
- `favorite_toggle` (target_type/id, direction)
- `vote` (target_type/id, direction)
- `comment_submit` (target_type/id)
- `login_from_gate` (action attempted, target_type/id, success)

## Data flow
- Client: PostHog JS for UI events; include user auth flag + current path.
- Server: Optionally mirror key events into `Event` table (views/copies/downloads/template_uses/builder_export) for ranking and counters.

## Counters and rollups
- Use `Event` table for raw events; nightly job aggregates into Snippet/Template/Document stats (views, copies, downloads, uses, votes/favorites/comments counts).
- Increment lightweight counters on write path when feasible; reconcile with rollup to avoid drift.

## Dashboards/alerts
- Funnels: landing → copy → signup; browse → add_to_builder → export → save.
- Content: top copied, top exported, favorites per user, conversion from gate.
- Alerts: spike in copy/download volume, error rate on engagement APIs.

## Implementation steps
1) Add PostHog client calls to new UI buttons (copy/download/add-to-builder/export/favorite/vote/comment gate).
2) Add server-side `Event` write for downloads/copies/exports (non-blocking, try/catch).
3) Nightly rollup script to update stats counters.
4) Dashboard presets in PostHog for funnels + content performance.
5) Wire feature flags: only emit public-library events when flag on; avoid logging PII in metadata.
6) Add sampling/tuning knobs for high-volume events (copy/download) to control noise.
