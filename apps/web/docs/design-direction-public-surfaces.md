# Visual Design Direction: Public Surfaces
Date: 2025-12-01  
Issue: markdowntown-7z8.11

## North Star
Public pages (landing, browse, detail, builder entry) should feel editorial, trustworthy, and fast: bold typography, generous white space, and action-forward cards that make “Copy” and “Use template” impossible to miss.

## Palette & tone
- Keep the existing MDT blues as primary; pair with warm accent (`mdt-accent`) for badges/highlights.
- Background: mostly light (`mdt-surface`), with subtle sections on `mdt-surface-subtle`.
- Avoid heavy gradients; use soft radial spotlights behind heroes/cards sparingly.
- Badge colors: staff pick = accent; trending = primary; new = success.

## Typography
- Headlines: consider a display face (e.g., Sora/Manrope) for hero + section headings; body stays Inter.
- Weight contrast: bold for headlines/CTAs, regular for body; generous line-height (1.4–1.5).
- Limit max-width for body copy (~70ch) to keep landing text readable.

## Layout patterns
- Card grids with consistent padding and 2–3 action buttons (Copy / Use template / Add to builder).
- Sticky action rail on detail pages (desktop) and sticky bottom bar on mobile for Copy/Use.
- Use pill tags and compact stat chips to reduce noise; avoid outlined ghost buttons except for secondary actions.
- Spacing rhythm: 16/24/32 step; keep gutters ≥24px on desktop, 16px mobile.

## Iconography & motion
- Use simple line icons for actions (copy, download, star/heart, vote arrows).
- Motion: fast (120–180ms) ease for hover/press; subtle fade/slide for content rails; no parallax.
- On hero CTA hover: slight lift + shadow; on cards: shadow deepen + border tint.

## Dark mode
- Maintain parity; lighten primary tint in dark (use `mdt-primary-strong` hover).
- Keep card backgrounds at `mdt-surface` with clear separators; avoid pure black for readability.

## Imagery
- Prefer abstract geometric spot art behind hero/device mock; avoid stock photography.
- For template spotlight, use code/markdown snippets as visual texture (blurred/frosted).

## Accessibility
- Minimum 4.5:1 for text on backgrounds; 3:1 for large text.
- Focus rings: high-contrast outline using `mdt-primary` + 2px offset.
- Ensure Copy/Use buttons remain visible in both color schemes.

## Application by page
- **Landing:** hero with spotlight; featured rails; tag cloud; “Why sign in” tile; consistent CTA coloring.
- **Browse:** clear filters row + sticky search; cards with visible stats; skeleton loaders for fast perceived speed.
- **Detail (snippet/template/doc):** two-column layout; sticky action rail; tabs for Rendered/Raw; related module with shared tags.
- **Builder entry:** wizard tiles with large, friendly icons; progress dots/steps at top.
