# Navigation & IA map (Dec 2025)

## Primary nav (desktop)
- Home `/`
- Browse `/browse`
- Templates `/templates`
- Tags `/tags`
- Builder `/builder`
- Docs `/docs`
- Search field: queries to `/browse?q=…`
- Theme toggle: light/dark
- Auth affordances: Sign in / Use a template CTA; user pill with avatar + sign out when authenticated.

## Mobile nav
- Bottom bar: Home, Browse, Templates, Builder, Search (opens sheet).
- Overflow sheet: Docs, Changelog (external), Privacy, GitHub.
- Search sheet: query + quick tags + recent searches.

## IA consistency
- Active state matches route prefix; breadcrumbs handled per page via `Breadcrumb` component.
- Command palette opens from `Cmd/Ctrl+K` (handled by nav search shortcuts for now; palette task tracked separately).
- URLs are semantic: browse/tag/template/detail/builder all under first-level paths.

## Planned refinements
- Move changelog/privacy/terms into footer on desktop; keep overflow for mobile only.
- Add “Products” grouping if new surfaces ship (e.g., Workbench, Library, Docs).
- Ensure nav links mirror sitemap used for SEO (update when new pages ship).
