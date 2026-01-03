# Palette Refresh A11y Contrast Report

Date: 2025-12-28
Owner: Codex
Scope: Primary text, primary CTA, surface-strong readability, and focus ring visibility for the refreshed palette.

## Method
- Contrast ratios computed using WCAG 2.1 relative luminance.
- Token values sourced from `src/app/globals.css`.
- Focus ring visibility confirmed via manual inspection on light/dark surfaces.

## Light theme checks

| Scenario | Tokens | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Primary text on surface | `--mdt-color-text` (hsl 222 50% 9%) on `--mdt-color-surface` (hsl 220 30% 99%) | 18.18:1 | >= 4.5:1 | Pass |
| Primary text on surface-strong | `--mdt-color-text` on `--mdt-color-surface-strong` (hsl 220 20% 92%) | 15.35:1 | >= 4.5:1 | Pass |
| Primary CTA text on primary | `--mdt-color-text-on-strong` (now `--mdt-neutral-900`) on `--mdt-color-primary` (hsl 196 88% 54%) | 8.29:1 | >= 4.5:1 | Pass |

## Dark theme checks

| Scenario | Tokens | Ratio | Target | Result |
| --- | --- | --- | --- | --- |
| Primary text on surface | `--mdt-color-text` (hsl 220 33% 92%) on `--mdt-color-surface` (hsl 220 18% 9%) | 14.85:1 | >= 4.5:1 | Pass |
| Primary text on surface-strong | `--mdt-color-text` on `--mdt-color-surface-strong` (hsl 220 16% 16%) | 12.29:1 | >= 4.5:1 | Pass |
| Primary CTA text on primary | `--mdt-color-text-on-strong` (hsl 220 16% 12%) on `--mdt-color-primary` (hsl 196 88% 64%) | 8.86:1 | >= 4.5:1 | Pass |

## Focus ring visibility
- `--mdt-color-ring` maintains visible contrast on both `--mdt-color-surface` and `--mdt-color-surface-strong` in light/dark.
- Manual check: outline and ring offset remain visible around primary/secondary buttons, inputs, tabs, and pagination.

## Adjustments made
- Light theme `--mdt-color-text-on-strong` now uses `--mdt-neutral-900` to ensure primary CTA contrast meets WCAG AA.

## Notes
- Soft status backgrounds (badge/pill) remain readable using text tokens defined in components.
