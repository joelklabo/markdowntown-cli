# Landing Page Modules (Rebuild)
Date: 2025-12-01  
Issue: markdowntown-7z8.25

## Modules to ship
- **Hero**: headline, subcopy, primary CTA “Use a template”, secondary “Browse snippets”, search bar inline; hero art with code/markdown stack.
- **Featured rail**: carousel of staff picks (snippets/templates/documents) with Copy/Use buttons, badges (Staff pick, Trending).
- **Trending grid**: 6 cards showing copies/views/votes; quick Copy; tags visible.
- **New this week**: list/rail of recent public items with timestamps and tags.
- **Tag cloud**: top tags; clicking applies filter to browse.
- **Template spotlight**: 3–6 templates with “Use template”; inline preview gif/animation optional.
- **Most-copied agents.md**: list with Copy/Download and brief description.
- **How it works**: 3-step explainer + Builder CTA.
- **Why sign in**: small card listing save/favorite/vote/comment benefits.
- **Footer**: Docs, Changelog, Privacy/Terms, GitHub link.

## Behavior
- CTAs scroll to relevant rails on the page when applicable.
- Modules hide if data empty (e.g., no tag cloud yet).
- Keep Copy/Use buttons always visible above the fold on cards.

## Data dependencies
- Feeds: trending/new/top/template spotlight, tag cloud, most-copied agents (use discovery feeds/tag cloud APIs).
- Metrics: copies/views/votes/favorites per card.

## Layout notes
- Two-column above the fold: hero text left, art right.
- Rails use 3–4 columns on desktop, 1–2 on mobile.
- Sticky header already defined in nav rewrite; hero should leave enough space to show first rail on first scroll.

## Checklist
- [ ] Wire rails to discovery/tag cloud endpoints.
- [ ] Render Copy/Use CTA on cards; Download for agents.md list.
- [ ] Add inline search bar in hero (hooks to browse page with query).
- [ ] Hide modules when no data; show skeletons while loading.
- [ ] Respect feature flags (`public_library`, `builder_v2`).
