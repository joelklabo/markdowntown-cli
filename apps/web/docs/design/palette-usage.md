# Palette usage

Use semantic tokens to keep surfaces consistent across light and dark themes. Avoid raw hex values and Tailwind neutrals outside token definitions.

## Core roles

| Token | Use when | Notes |
| --- | --- | --- |
| `primary` | Primary CTA buttons, active states, key highlights | Should represent the single most important action on a surface. |
| `accent` | Secondary highlights and marketing emphasis | Use sparingly; never compete with primary CTA. |
| `surface` | Default card and page surfaces | Base layer for most containers. |
| `surface-subtle` | Secondary panels, inputs, soft backgrounds | Keep text at `text` or `text-muted`. |
| `surface-strong` | Active tabs, selected rows, hover states | Use for elevation without overpowering content. |
| `border` / `border-strong` | Dividers and container outlines | Prefer `border` for most boundaries. |
| `text` | Body copy and primary labels | Default text color. |
| `text-muted` | Secondary labels and helper text | Use for non-critical context. |
| `text-subtle` | Tertiary labels or large-caption text | Avoid on `surface-subtle` for small body text. |

## CTA hierarchy
- **Primary CTA**: `Button` variant `primary` (solid fill) for the main action.
- **Secondary CTA**: `Button` variant `secondary` for supporting actions.
- **Tertiary CTA**: `Button` variant `ghost` for least important actions.

## Status colors
- Use `success`, `warning`, `danger`, and `info` for status indicators only.
- Prefer soft backgrounds for pills/badges and keep text readable at 4.5:1.
- If a status is critical, elevate it with `text` + icon instead of brighter fills.

## Light and dark parity
- Tokens are designed to switch automatically in dark mode; keep usage consistent.
- Validate contrast with `docs/qa/contrast-audit.md` after palette changes.
- Use `text` or `text-muted` on `surface-subtle` for small text in light theme.

## Related references
- `docs/qa/contrast-audit.md`
- `docs/USER_GUIDE.md`
