# Library Browse Page (Filters, Search, Quick Copy)
Date: 2025-12-01  
Issue: markdowntown-7z8.26

## Requirements
- Public browse of Snippets/Templates/Files with a single primary CTA: **Open in Workbench**.
- Secondary actions (Copy/Use/Download/Preview) are available but visually de-emphasized.
- Filters are simplified: type + sort + top tags; advanced filters live in a “More filters” drawer.
- Empty state guidance explains how to broaden filters or start with a scan.

## CTA hierarchy
- Primary: **Open in Workbench** on every card (button style).
- Secondary: **Preview**, **Copy**, **Download** (inline secondary buttons or overflow menu).
- Tertiary: **Share** / **Fork** (overflow-only).

## Layout
- Top bar: search input (⌘/) + sort (Recent, Trending, Most copied) + type filter pills (All, Snippets, Templates, Files).
- Filters (desktop rail / mobile sheet): top tags, reset button, advanced filters collapsed behind “More filters”.
- Results: cards show title, badges (New/Trending/Staff Pick), stats, tags, **primary CTA: Open in Workbench**.
- Secondary actions appear in an overflow menu or on detail view.
- Pagination or “Load more” infinite scroll; preserve filters in URL.

## Data wiring
- Use public search API (`/api/public/search`) with params: `q`, `type`, `tags`, `sort`, `page/cursor`.
- Default to recent feed when `q` empty; fall back to list endpoints if search down.
- Tag pills sourced from tag cloud endpoint (top tags only).

## Performance
- Debounce search input; optimistic UI for filters.
- Cache initial data with ISR; client uses SWR for revalidation.
- Skeletons while loading; keep interactions usable during fetch.

## Empty state guidance (copy)
- “No results yet. Try clearing filters or start with a scan to create your own artifact.”
- CTA: “Scan a folder” (primary), “Browse all” (secondary).

## Checklist
- [ ] Implement filter state synced to query params.
- [ ] Hook search + sort + type filters to `/api/public/search`.
- [ ] Render card actions with **Open in Workbench** as primary.
- [ ] Handle empty states and error fallback.
- [ ] Mobile filter sheet; desktop left rail with sticky position.
- [ ] Analytics: track filter changes and primary CTA clicks.
