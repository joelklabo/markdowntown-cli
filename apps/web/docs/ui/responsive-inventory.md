# Responsive Inventory

Date: 2025-12-26
Scope: Core surfaces and global UI across breakpoints.

## Breakpoints referenced
- Base: < 640px
- sm: ≥ 640px
- md: ≥ 768px
- lg: ≥ 1024px
- xl: ≥ 1280px

## Global navigation
- **Base / sm**
  - Mobile bottom nav visible (Scan / Workbench / Library / Translate / Search).
  - Header shows compact controls; search, command palette, and density toggle hidden.
  - Mobile search + overflow sheets used for search/links.
  - Header banner height: 48px; nav min-height: 56px; padding y: 12px.
  - Mobile CTAs must sit above `env(safe-area-inset-bottom)` and remain tappable.
- **md**
  - Desktop header nav appears; mobile bottom nav hidden.
  - Theme toggle shown; search bar visible.
  - Header banner height: 56px; nav min-height: 64px; padding y: 16px.
- **lg**
  - Command palette button + density toggle visible.
  - Search input expands width.

## Surface inventory

### Home (`/`)
- Base → stacked hero + CTA blocks.
- md → hero splits into 2 columns (`md:grid`), supporting panels align right.
- sm → some CTA rows switch from stacked to inline (use of `sm:flex-row`).

### Atlas Simulator (`/atlas/simulator`)
- Base → single column; scan setup + results stacked.
- lg → two-column split (`lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]`).
- Buttons and path upload use `sm:w-auto` to reduce full-width buttons on larger screens.

### Library (`/library`)
- Base → filters and results stacked.
- lg → left filter column becomes sticky sidebar (`lg:grid-cols-[320px_1fr]`, `lg:sticky`).

### Workbench (`/workbench`)
- Base → tabbed interface (`md:hidden`) for Structure / Editor / Output.
- md → three-column layout (`md:grid-cols-[280px_minmax(0,1fr)_320px]`).
- Height locked to viewport (`h-[calc(100vh-64px)]`) with internal scroll regions.
- Verify dynamic viewport handling on mobile (address bar collapse/expand, `dvh` vs `vh`).
- When OSK opens, ensure editor remains usable and CTAs are not occluded.

### Translate (`/translate`)
- Base → input/output stacked.
- lg → two-column grid (`lg:grid-cols-2`).

### Docs / Legal (`/docs`, `/privacy`, `/terms`, `/changelog`)
- Primarily single-column content with max-width containers.
- Spacing increases at md via `md:py-*` patterns.

## Responsive risks / conflicts
- Bottom nav occupies vertical space; content must keep safe-area padding to avoid overlap.
- Workbench fixed-height layout risks clipping on short mobile screens.
- Atlas Simulator left/right columns may feel narrow at small `lg` widths; check card density.
- Header + sticky components can stack (header + sticky filters + bottom nav), which can reduce usable content height.
- Toasts/snackbars should not cover bottom nav CTAs.
- Landscape mode can over-constrain vertical space; confirm primary CTA remains tappable.
