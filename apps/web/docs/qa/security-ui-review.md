# Security UI Review Checklist
Date: 2025-12-20
Owner: markdowntown-w2tl

## Scope
- Auth surfaces: sign-in, sign-out, session-expired prompts.
- Critical actions: publish, delete, visibility changes, export/download.
- Error/warning states: permissions, rate limits, validation, auth failures.
- System notices: banners, toast alerts, inline warnings.

## Checklist
### Auth CTAs
- Sign-in and sign-out buttons are visible above the fold on desktop and mobile.
- Auth CTAs are distinguishable from secondary actions (clear primary styling).
- The sign-in flow copy mentions data scope and provider (GitHub) clearly.
- Callback URLs are visible in browser without exposing sensitive data.

### Warnings + Errors
- Error states use semantic danger tokens (`mdt-danger`) with sufficient contrast.
- Warning copy is legible in light/dark and not hidden behind overlays.
- Permission errors explicitly state access requirements (owner/admin).
- Rate-limit and validation errors are not dismissible without reading content.

### Critical Actions
- Destructive actions require confirmation or secondary step.
- Publish/visibility toggles describe current state and next state.
- Actions that write data show a status badge or toast confirmation.

### Layout + Focus Safety
- Focus ring is visible on all critical buttons and inputs (light/dark).
- Key CTAs are not truncated or wrapped in narrow breakpoints.
- Modal dialogs trap focus and restore focus on close.

### High-Contrast / Dark Theme
- Text + buttons remain readable at high-contrast settings.
- Danger/warning colors are still distinct on dark backgrounds.
- Critical messaging does not rely on color alone (icon or text cue present).

## Findings
- None logged yet. Add issues as needed.
