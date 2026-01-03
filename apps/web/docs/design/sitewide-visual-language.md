# Sitewide Visual Language Alignment

Date: 2025-12-20
Owner: Design
Goal: Align overall UI with the Living City header while maintaining a professional product feel.

## Principles
- **Professional first**: treat the wordmark as a signature brand element, not a novelty texture.
- **Pixel hints, not pixel noise**: reuse palette/contrast and subtle grid motifs without turning the UI into pixel art.
- **Calm hierarchy**: prioritize clear typography and consistent spacing; avoid over-decoration.

## Palette Alignment
Use the header palette as a guide, not a literal theme.

### Core tokens (existing)
- `--mdt-color-surface`, `--mdt-color-surface-raised`, `--mdt-color-border`
- `--mdt-color-text`, `--mdt-color-text-muted`, `--mdt-color-text-subtle`
- Accent tokens: `--mdt-color-primary` (cyan), `--mdt-color-accent` (amber), `--mdt-color-warning`, `--mdt-color-danger`

### Guidance
- **Header**: maintain the night-sky banner but add breathing room above/below the strip. Avoid hard clipping.
- **Surfaces**: introduce a faint cool tint on raised surfaces (2–4% shift toward the wordmark sky color).
- **Accents**: reserve saturated cyan for primary CTA/focus; use warm amber sparingly for highlights, badges, and key emphasis.
- **Dividers**: use softer borders (opacity 40–60%) to reduce harsh contrast against the header.
- **Footer**: consider a subtle cool wash or gradient pulled from the header palette.

## Spacing & Rhythm

### Baseline
- 4px grid; prefer 8/12/16/24/32 for spacing.
- Top-of-page sections should have **24–32px** vertical padding after the header.

### Components
- **Cards**: minimum padding 16px (mobile) / 24px (desktop).
- **Buttons**: min-height 36px (desktop) / 44px (mobile). Preserve existing sizing for primary CTA.
- **Inputs**: height 40px (desktop); 44px for mobile inputs.
- **Chips**: increase horizontal padding to avoid cramped text.

## Header Alignment
- Keep the banner full width, but add a **2–4px** inset or padding to avoid visual clipping.
- Ensure nav underline thickness and tab underline thickness match.
- Header search row should have clear separation from the banner (1–2 spacing units).

## Tabs / Pickers
- Consolidate tabs into a single shared style: 44px min height, 12–16px horizontal padding.
- Active indicator: 2px underline or pill background, consistent across header and workbench tabs.
- Keyboard focus: visible outline and contrast-compliant.

## Light/Dark Rules
- Ensure wordmark contrast is **>= 3:1** vs. sky in both themes.
- Avoid low-contrast “muted on muted” pairings for secondary labels.
- Keep CTA color consistent across light/dark; only adjust background tones.

## Motion & Texture
- Wordmark twinkle/shimmer stays subtle (no more than 10–15% opacity change).
- Use no more than one additional subtle motion in the UI (e.g. card hover lift).
- If adding texture, keep it faint (2–4% alpha) and only in large surfaces.

## Implementation Notes
- Prefer token adjustments in `src/app/globals.css` rather than per-component overrides.
- If introducing new tokens, document them in `docs/design/sitewide-visual-language.md`.
- Keep the header as the primary brand surface; avoid repeating the wordmark motif elsewhere.
