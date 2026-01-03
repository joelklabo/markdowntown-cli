# Contrast + focus audit (palette refresh)

Date: 2025-12-29
Owner: @honk

## Scope
- Light + dark themes using semantic tokens in `src/app/globals.css`.
- Primary surfaces, buttons, and status pills/badges.
- Focus ring visibility against default surfaces.

## Method
- WCAG contrast ratio math (relative luminance) against token HSL values.
- Thresholds: 4.5:1 for normal text, 3:1 for large text and focus indicators.
- Soft status backgrounds computed by compositing the token’s alpha over the surface color.

## Results (light theme)

| Pair | Ratio | Result |
| --- | --- | --- |
| Text on surface (`text` / `surface`) | 18.18 | Pass |
| Muted text on surface (`text-muted` / `surface`) | 6.89 | Pass |
| Subtle text on surface (`text-subtle` / `surface`) | 4.98 | Pass |
| Text on surface-subtle (`text` / `surface-subtle`) | 16.90 | Pass |
| Muted text on surface-subtle (`text-muted` / `surface-subtle`) | 6.40 | Pass |
| Subtle text on surface-subtle (`text-subtle` / `surface-subtle`) | 4.63 | Pass |
| Primary button text (`text-on-strong` / `primary`) | 8.30 | Pass |
| Primary-strong button text (`text-on-strong` / `primary-strong`) | 6.72 | Pass |
| Success text on success-soft | 4.72 | Pass |
| Warning text on warning-soft | 4.50 | Pass |
| Danger text on danger-soft | 4.53 | Pass |
| Info text on info-soft | 4.60 | Pass |

## Results (dark theme)

| Pair | Ratio | Result |
| --- | --- | --- |
| Text on surface (`text` / `surface`) | 14.52 | Pass |
| Muted text on surface (`text-muted` / `surface`) | 9.06 | Pass |
| Subtle text on surface (`text-subtle` / `surface`) | 6.65 | Pass |
| Text on surface-subtle (`text` / `surface-subtle`) | 13.05 | Pass |
| Muted text on surface-subtle (`text-muted` / `surface-subtle`) | 8.14 | Pass |
| Subtle text on surface-subtle (`text-subtle` / `surface-subtle`) | 5.98 | Pass |
| Primary button text (`text-on-strong` / `primary`) | 8.86 | Pass |
| Primary-strong button text (`text-on-strong` / `primary-strong`) | 10.23 | Pass |
| Success text on success-soft | 7.09 | Pass |
| Warning text on warning-soft | 6.90 | Pass |
| Danger text on danger-soft | 5.04 | Pass |
| Info text on info-soft | 6.47 | Pass |

## Focus rings

| Indicator | Ratio | Result |
| --- | --- | --- |
| Ring on light surface (`ring` updated) | 3.36 | Pass |
| Ring on light surface-subtle (`ring` updated) | 3.12 | Pass |
| Ring on dark surface (`ring` updated) | 10.40 | Pass |
| Ring on dark surface-subtle (`ring` updated) | 9.35 | Pass |

## Findings
- Light theme `text-subtle` on `surface-subtle` now meets 4.5:1 (4.63).
- Focus ring contrast now meets >=3:1 on light/dark surfaces after token updates.
- Status soft variants now meet >=4.5:1 in light theme, and danger-soft meets >=4.5:1 in dark theme after token updates.

## Recommendations
- `text-subtle` on light `surface-subtle` now passes but remains near the threshold; prefer `text-muted` for dense body copy.

## Follow-up tasks
- markdowntown-e1tq — Improve subtle text contrast on surface-subtle.
- Resolved: markdowntown-45rr — Fix status soft contrast (light theme + dark danger).
- Resolved: markdowntown-da2s — Improve focus ring contrast to >= 3:1.
