# Information Architecture & Navigation Map (Public-First)
Date: 2025-12-01  
Issue: markdowntown-7z8.8

## Primary destinations
- Landing (`/`): hero + featured/trending/new modules; search bar; tag pills; “Use template” spotlight.
- Browse (`/browse`): unified library with filters (type, tags, sort) and search; cards for snippets/templates/documents.
- Templates (`/templates`): template-only gallery + filters; CTA “Use template”.
- Tags (`/tags` + `/tags/[tag]`): tag cloud + tag-specific browse.
- Snippet detail (`/snippets/[slug]`): rendered + raw, stats, related, add-to-builder.
- Template detail (`/templates/[slug]`): rendered + raw, fields schema, form-fill drawer, use/copy/download CTAs.
- Document detail (`/files/[slug]`): rendered agents.md, raw, stats, “Clone”/“Copy”/“Download”.
- Builder (`/builder`): multi-step (Template → Snippets → Arrange → Preview → Export); anon export, authed save.
- Auth/account (`/login`, profile/favorites/history) – kept lightweight, linked from user menu.
- About/help: minimal footer links (Docs, Changelog, Privacy, Terms).

## Navigation (header)
- Left: brand logo → `/`.
- Main links: Browse, Templates, Tags, Builder, Docs.
- Search bar inline on desktop; search icon → modal on mobile.
- Right: CTA button “Use a template” (or “Start building”); secondary “Sign in” (if logged out) or avatar menu (favorites, documents, logout).

## Mobile nav
- Top bar: logo + search icon + avatar/sign-in.
- Bottom tab bar (optional): Home, Browse, Templates, Builder.

## Breadcrumbs
- Show on detail pages: Home / Templates / {template title}; Home / Browse / {tag}; improves orientation and SEO snippets.

## Cross-linking patterns
- Cards show badges (Staff pick/New/Trending), stats (copies/votes/views), tags, and quick actions (Copy/Use template/Add to builder).
- Related modules: “More like this” (shared tags), “Often copied together” (co-usage).
- Builder entry points: buttons on cards, detail pages, landing modules.

## IA rules
- Public routes do not require auth; gated actions trigger inline sign-in prompt and retry the action after auth.
- Separate public vs authed overlays to avoid cache bleed; use `Vary: Cookie` on pages that show personal state.
- Keep URL slugs stable; tag URLs lowercase kebab.

## Sitemap/meta
- Include landing, browse, templates, tags, detail pages, documents (public), and builder.
- OG: use per-item title/description and og:image; no auth-gated content in previews.
