# Product Brief: Open Snippet/Template Library
Date: 2025-12-01  
Issue: markdowntown-7z8.7 (Site redesign: public library & agents.md workflows)

## Problem
- High drop-off on first visit because valuable snippets/templates are locked behind auth.
- Builders lack a curated, copy-ready library and spend time piecing content from scattered docs.
- Existing composer is private-first; doesn’t drive discovery, sharing, or community signals.

## Users & JTBD
- **Anonymous explorer**: “Show me high-signal snippets/templates I can copy or download immediately.”
- **Returning builder** (signed-in): “Assemble an agents.md quickly from favorites/recents/templates; export or save a version.”
- **Contributor/author**: “Publish my snippets/templates, track usage (views/copies/votes), and get feedback.”

## Goals (launch)
- Publicly browse/search snippet + template catalog without login.
- One-click copy/download; “Use template” duplicates into builder with placeholder form-fill.
- Detail pages show rendered + raw views, tags, stats, related items, and add-to-builder CTA.
- Encourage signup via lightweight gates for save/favorite/vote/comment.

## Non-goals
- Paid marketplace or revenue features.
- Org/workspace ACL.
- Advanced collaboration (comments in-line, presence).

## Success metrics (30d post launch)
- Copy/download per unique visitor: +25% vs current baseline.
- Anonymous→signup conversion: +15% driven by gated actions (favorite/vote/save).
- Median time-to-first-copy from landing: <20s p50.
- Template adoption: ≥20% of saved Documents originate from a template.
- SEO: organic landing traffic +X% (baseline needed), sitemap indexed items ≥90%.

## Scope (MVP)
- Pages: landing with featured/trending/new; browse/search with filters/sorts/tag pills; snippet detail; template detail; tags index; builder entry.
- Actions: copy/download; “Use template” into builder; add to builder; save/favorite/vote/comment (authed only).
- Data: visibility=public/unlisted/private; stats (views/copies/downloads/votes/favorites); tags and kind/type.
- Infrastructure: ISR + tag-based revalidate, public/read APIs, rate limiting on writes, sanitized rendering, basic analytics events.

## Out of scope (MVP)
- Collaborative editing; multi-user docs.
- Monetization; paywalled content.
- Custom roles/teams; org-level sharing.

## Release plan
1) **Public browse+detail** behind `public_library` flag; ship with seeded public snippets/templates.  
2) **Template “Use template” + builder entry**; anon export, authed save.  
3) **Engagement**: votes/favorites/comments; surface stats/badges.  
4) **SEO pass**: sitemap, meta/OG, tag pages open.  
5) **Telemetry & tuning**: measure copy/download and conversion; adjust ranking/placement.

## Risks & mitigations
- Cache bleed between anon/authed → split public payloads from user overlays; `Vary: Cookie`; auth-only fetches uncached.
- Abuse on votes/comments → rate limits + captcha for suspicious traffic.
- Low quality surface → curation (staff picks/trending), badges, and moderation for flagged content.
