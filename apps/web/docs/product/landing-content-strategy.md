# Landing Page Content Strategy (agents.md workflows)
Date: 2025-12-01  
Issue: markdowntown-7z8.9

## Purpose
Make the homepage immediately useful to anonymous visitors: show high-signal content, clear CTAs to copy/use templates, and a short path into the builder—while gently prompting signup for saves/favorites/votes/comments.

## Core story blocks
- **Hero**: One-liner (“Build agents.md faster with curated snippets & templates”), search bar, primary CTA “Use a template”, secondary “Browse snippets”.
- **Featured rails**: Trending snippets, Staff picks, New this week, Top templates; each card shows badges, tags, stats, Copy/Use buttons.
- **How it works (3 steps)**: Pick template → Add/arrange snippets → Copy/download agents.md (anon) or Save (authed).
- **Template spotlight**: 3–6 top templates with “Use template” CTA; inline form-fill preview gif/video if available.
- **Tag cloud + filters**: Popular tags (tools/models/domains) to jump into browse with filter applied.
- **Social proof**: Counters (copies/downloads), brief testimonials or “Used by …” row; optional GitHub stars if relevant.
- **Why sign in**: Save favorites, vote/comment, version documents; small card near fold.
- **Footer**: Docs, Changelog, Privacy/Terms, GitHub link.

## Content principles
- Lead with value (content) not product chrome; no login wall for copy/download.
- Keep hero copy short; avoid jargon; emphasize speed and reuse.
- Always pair stats with action buttons; surface copy/download on cards and detail pages.
- Reuse tags/kinds to avoid empty states—hide sections if no content seeded.

## CTAs & gating
- Primary CTA: “Use a template” (scrolls to templates rail or opens builder with template picker).
- Secondary: “Browse snippets”.
- Inline gate on save/favorite/vote/comment with post-auth retry.

## SEO/meta
- H1: “mark downtown agents.md library” (or similar); include “snippets” and “templates”.
- Meta description: highlight copy/download and templates; avoid feature-flagged claims until live.
- Structured data: ItemList for featured rails; BreadcrumbList for nav.

## KPIs to watch
- Time-to-first-copy from landing.
- Copy/download rate per UV.
- Click-through from hero CTA to builder/templates.
- Conversion on gated actions (save/favorite).
