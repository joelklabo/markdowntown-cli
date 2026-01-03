# Mobile Navigation Research Notes
Date: 2025-12-01
Issue: markdowntown-09i.1

## Sources
- Smashing Magazine (2024): Bottom navigation should surface 3–5 top destinations with text labels, no mixed drawers, and >44px touch targets; reserve overflow/hamburger for secondary items.
- MoldStud UX roundup (2025): Users prefer bottom nav over hamburger for frequent actions; clarity of labels beats icon-only tabs; keep hierarchy shallow.
- Arnology mobile nav guide (2025): Pair a top bar (brand + search/account) with a bottom tab bar; keep active states obvious and avoid scroll-jank by using translucent backgrounds and subtle shadow.

## Direction for MarkdownTown
- Keep a 4-tab bottom bar: Home, Browse, Templates, Builder; dedicate the fifth slot to a search trigger instead of stuffing more links.
- Move Docs/Changelog/Privacy into a lightweight overflow sheet; do not duplicate CTAs between header and bottom bar.
- Keep search always-one-tap: icon in top bar opens modal; keyboard shortcuts remain for desktop.
- Make hit targets ≥44px, sticky with a soft shadow; active tab uses text + pill indicator and high-contrast icon.
- Reduce motion: fade/slide ≤180ms on open/close; avoid parallax; respect prefers-reduced-motion.
- Ensure focus order left→right and aria-current on active tabs; keep labels visible under icons (no icon-only tabs).
