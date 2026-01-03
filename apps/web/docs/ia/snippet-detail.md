# Snippet Detail Page (Rendered + Raw, Stats, Related)
Date: 2025-12-01  
Issue: markdowntown-7z8.27

## Content & layout
- Hero block: title, tags, type/kind, author, last updated, badges (New/Trending/Staff pick).
- Actions (sticky on desktop, bottom bar on mobile): Copy, Download, Add to builder; gated icons for Favorite/Vote/Comment.
- Tabs: Rendered | Raw (markdown). Rendered preview uses sanitized HTML; Raw shows code block with copy button.
- Stats: views, copies, downloads, votes, favorites; show tooltips for definitions.
- Related: “More like this” (shared tags), “Often copied together”.
- Comments: collapsible, auth-gated.

## Data
- GET `/api/public/snippets/[slug]` returns rendered, raw, stats, tags, related IDs.
- Auth overlay fetch for user state (vote/favorite) if signed in; keep main payload cached.

## Behavior
- Copy/Download always available to anon; favorite/vote/comment prompt sign-in and retry action.
- Add to builder adds snippet to builder state (local).
- Badge logic driven by feeds (trending/new/staff pick).

## Checklist
- [ ] Rendered/Raw tabs with copy buttons.
- [ ] Sticky action rail; mobile bottom CTA bar.
- [ ] Stats display wired to counters; hide if zero? (config).
- [ ] Related content modules fed by search/tag feeds.
- [ ] Auth overlay fetch for user-specific state; main payload cached.
- [ ] Analytics: copy/download/add-to-builder; gate conversions.
