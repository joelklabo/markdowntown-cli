# Palette Token Map (2025)

Date: 2025-12-28
Owner: Design
Goal: Map semantic UI roles to tokens to keep components consistent across light/dark themes.

## Core semantic roles

| Role | Tokens | Usage | Notes |
| --- | --- | --- | --- |
| Primary | `--mdt-color-primary`, `--mdt-color-primary-strong`, `--mdt-color-primary-soft` | Primary CTAs, active states, emphasis | Use `primary-strong` for hover/active; `primary-soft` for subtle fills. |
| Accent | `--mdt-color-accent`, `--mdt-color-accent-soft` | Secondary emphasis, highlights, badges | Avoid using as primary CTA background. |
| Success | `--mdt-color-success`, `--mdt-color-success-soft` | Success banners, confirmations | Pair with text-on-strong when on dark fills. |
| Warning | `--mdt-color-warning`, `--mdt-color-warning-soft` | Warnings, caution states | Keep warning text at >= 4.5:1 on subtle fills. |
| Danger | `--mdt-color-danger`, `--mdt-color-danger-soft` | Errors, destructive actions | Use `danger-soft` for banners and inline alerts. |
| Info | `--mdt-color-info`, `--mdt-color-info-soft` | Info tips, neutral callouts | Prefer info-soft for calm callouts. |
| Ring | `--mdt-color-ring` | Focus outlines, keyboard focus | Must maintain >= 3.0:1 contrast against surfaces. |

## Surfaces + structure

| Role | Tokens | Usage | Notes |
| --- | --- | --- | --- |
| Background | `--mdt-color-bg` | Page background | Base layer for all surfaces. |
| Surface | `--mdt-color-surface` | Primary containers, panels | Default card/panel background. |
| Surface subtle | `--mdt-color-surface-subtle` | Section backgrounds, subtle cards | Use for grouping without heavy contrast. |
| Surface strong | `--mdt-color-surface-strong` | Emphasized panels, chips | Avoid for large page areas. |
| Surface raised | `--mdt-color-surface-raised` | Floating elements (menus, popovers) | Pair with soft shadows. |
| Overlay | `--mdt-color-overlay` | Modals, scrims | Ensure text remains legible. |
| Border | `--mdt-color-border` | Default dividers | Low contrast; use `border-strong` for emphasis. |
| Border strong | `--mdt-color-border-strong` | Active states, separators | Use sparingly to avoid noise. |

## Typography roles

| Role | Tokens | Usage | Notes |
| --- | --- | --- | --- |
| Text | `--mdt-color-text` | Body text | Keep >= 4.5:1 contrast on surfaces. |
| Text muted | `--mdt-color-text-muted` | Secondary text | Target >= 3.0:1 contrast. |
| Text subtle | `--mdt-color-text-subtle` | Tertiary labels, helper text | Avoid on low-contrast backgrounds. |
| Text on strong | `--mdt-color-text-on-strong` | Text on primary/accent fills | Always verify contrast. |

## Wordmark + data-viz guidance
- Wordmark glow uses `--mdt-color-primary` in moderation; avoid large filled areas.
- Data-viz series: align primary series with `--mdt-color-primary`, secondary with `--mdt-color-accent`, and alerts with status tokens.
- Use `--mdt-color-text` for annotations to keep charts legible across themes.

