# Navigation map (IA + naming)

Last updated: Dec 20, 2025

## IA principles
- Prioritize the scan -> build -> export flow in global navigation.
- Keep one primary route per major surface to reduce choice overload.
- Keep legacy routes for compatibility but hide them from primary nav.

## Global nav (desktop + mobile)
- **Logo** -> `/` (Home)
- **Scan** -> `/atlas/simulator` (primary entry to folder scan)
- **Workbench** -> `/workbench`
- **Library** -> `/library`
- **Translate** -> `/translate`
- **Docs** -> `/docs`
- **Search** -> Command palette / Library search (icon-only on mobile)

## Secondary nav / overflow
- **Atlas** -> `/atlas` (deep reference hub)
- **Changelog** -> `/changelog`
- **Privacy** -> `/privacy`
- **Terms** -> `/terms`
- **GitHub** -> external repo link

## Key surface map
- `/` Home (primary CTA: Scan a folder)
- `/atlas/simulator` Scan a folder (primary CTA: Open Workbench)
- `/workbench` Build + export agents.md
- `/library` Browse templates/snippets/files
- `/translate` Convert existing instructions
- `/docs` Docs landing

## Deep Atlas routes (not in primary nav)
- `/atlas/platforms` Tool profiles and example context
- `/atlas/concepts` Concepts and behavior docs
- `/atlas/recipes` Patterns for agents.md
- `/atlas/compare` Feature comparison matrix
- `/atlas/changelog` Atlas changes

## Library detail routes (not in primary nav)
- `/templates` Templates index
- `/snippets` Snippets index
- `/tags` Tag collections
- `/artifacts/[slug]` Artifact detail
- `/files/[id]` File detail

## Legacy and redirect routes
- `/browse` -> `/library` (keep for external links)
- `/builder` -> `/workbench` (legacy redirect; avoid the Builder label in UI)

## Authenticated surfaces (not in primary nav)
- `/documents` Your saved agents.md files (requires sign-in)
- `/documents/new` Create a new saved document
- `/documents/[id]` Edit saved document

## Naming conventions
- Use action nouns for primary nav labels: Scan, Workbench, Library, Translate, Docs.
- Prefer "agents.md" in user-facing text (lowercase) and "AGENTS.md" only when referencing the repo file name.
- Avoid internal labels like "builder" or "browse" in navigation.
