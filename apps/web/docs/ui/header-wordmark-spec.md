# Header + Wordmark Sizing Spec

Date: 2025-12-26
Scope: Site header banner + nav sizing and wordmark behavior.

## Objectives
- Keep header height stable (no post-load collapse).
- Avoid hydration mismatches between SSR and CSR.
- Ensure wordmark animation never changes layout size.

## CSS variables (source of truth)
These variables must always have fallbacks to avoid zero height.

### Banner height
- `--mdt-site-header-banner-height` (base)
- `--mdt-site-header-banner-height-md` (md+)

Recommended defaults:
- base: 48px
- md+: 56px

### Nav height + padding
- `--mdt-site-header-nav-min-height` (base)
- `--mdt-site-header-nav-min-height-md` (md+)
- `--mdt-site-header-nav-padding-y` (base)
- `--mdt-site-header-nav-padding-y-md` (md+)

Recommended defaults:
- base min height: 56px
- md+ min height: 64px
- base padding y: 12px
- md+ padding y: 16px

## Layout rules
- Banner and nav must always render with non-zero height, even before JS loads.
- Wordmark SVG must fill the banner container but never affect banner height.
- Header height must be stable for at least 5 seconds after load (desktop + mobile).
- Avoid CSS that depends on runtime JS to set baseline height.

## Wordmark behavior
- Wordmark should be rendered as a fluid banner inside `.mdt-site-header-banner`.
- Animation is allowed only when:
  - `prefers-reduced-motion` is not set, AND
  - `NEXT_PUBLIC_WORDMARK_ANIM_V1` is enabled, AND
  - wordmark banner flag is enabled.
- Animation must not change container size; only internal pixels.
- Fallback text wordmark is required if rendering fails.

## Edge cases
- Reduced motion: render static wordmark; no animation.
- Wordmark disabled: render text fallback; keep banner height.
- Ultra-wide screens: banner should scale visually but not change height.
- Small mobile widths: ensure header stays within the minimum height and padding.
- Safe-area insets: do not let banner or nav overlap bottom nav or top insets.

## QA checklist
- Load `/atlas/simulator`, `/workbench`, `/library` and wait 5s.
- Resize from base to md and back; header height should not snap.
- Toggle theme + density; header height should remain stable.
- Enable reduced motion; wordmark should be static.

