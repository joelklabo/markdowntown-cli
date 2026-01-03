# Wordmark: Voxel cityscape (“mark downtown”)

Date: 2025-12-18

## Goal
Create a wordmark that **visually spells “mark downtown”** using a voxel/cityscape motif (Minecraft-like blocks), suitable for the sticky header.

Constraints:
- **Transparent background** (renders on top of header surface).
- **Theme-inverted** feel:
  - **Light theme** shows a *nighttime* skyline.
  - **Dark theme** shows a *lit* city (windows/streetlights feel brighter).
- Subtle, decorative motion only; respects `prefers-reduced-motion`.

## Component surface
Primary usage is `src/components/Wordmark.tsx` (linked in header via `src/components/SiteNav.tsx`).

### Sizes
The wordmark must remain legible and not overflow the header at these sizes:
- `sm`: mobile header + compact desktop
- `md`: default
- `lg`: marketing/hero use

Implementation guideline:
- Use a consistent grid unit (e.g. `u=2` or `u=3` SVG units) and scale the SVG via CSS, not by regenerating geometry per size.
- Keep `viewBox` stable across sizes; use CSS to set `height` and allow width to auto.

## Construction (voxel rules)
### Grid + blocks
- Use a fixed grid for blocks; blocks are **axis-aligned squares**.
- Use a **1px-ish gap** (or implied gap via stroke) between blocks to preserve voxel/pixel readability.
- Prefer crisp corners; rounding is optional but should be minimal and consistent.

### Word layout
- Render as **one line**: `mark` + spacer + `downtown`.
- Visual motif: letters can read like “buildings” (varying heights), but the text must remain readable.
- Use a slightly stronger emphasis for “downtown” (more windows / glow) to reinforce the city theme.

### Detail layers
Suggested layers (all optional, but keep the final SVG lightweight):
1. **Buildings/letterforms**: primary voxel shapes.
2. **Windows**: smaller blocks or rects inside buildings/letters.
3. **Night accents**: sparse stars, moon, subtle skyline contour highlights.

## Theme-inverted palette
Define CSS variables so the same SVG can render differently per theme:

Recommended variables (names can change, keep the intent):
- `--mdt-wordmark-building`
- `--mdt-wordmark-building-muted`
- `--mdt-wordmark-window`
- `--mdt-wordmark-window-glow`
- `--mdt-wordmark-star`
- `--mdt-wordmark-moon`

### Light theme = nighttime
- Buildings: darker ink/blue on light surfaces (night silhouette).
- Windows: muted warm light (small, sparse).
- Stars/moon: subtle, low-contrast accents.

### Dark theme = lit city
- Buildings: slightly lighter than background to stay visible.
- Windows: brighter warm lights + occasional “streetlight” accent.
- Optional: small halo/glow around windows (avoid heavy SVG filters if possible).

## Motion (subtle)
Motion is *decorative* and should never compete with navigation.

### Allowed motion
- Window twinkle: opacity changes with low amplitude.
- Star shimmer: opacity + tiny scale.

### Motion constraints
- Avoid sharp on/off blinking and avoid high-contrast flashes.
- Prefer long durations and staggered delays:
  - Twinkle: `4–10s` duration
  - Shimmer: `6–14s` duration
- Keep opacity delta small (e.g. 0.65 → 1.0), not 0 → 1.

### Reduced motion
Under `prefers-reduced-motion: reduce`:
- Disable all wordmark animations.
- Keep static rendering (no opacity pulsing).

## Accessibility
- The wordmark is a navigation affordance: its accessible name must be **“mark downtown”**.
- Inline SVG requirements:
  - `role="img"`
  - `<title>` + `<desc>` in the SVG
  - `aria-labelledby` referencing both
- If the SVG is purely decorative within a link that already has text, mark it `aria-hidden`. (Not expected here; the SVG *is* the label.)

## Performance
- Keep DOM nodes low (target: <200 SVG elements).
- Avoid large/expensive filters; prefer flat fills + subtle opacity.
- Ensure no layout shift: dimensions should be stable in header.

