# UI QA Matrix

Date: 2025-12-26
Scope: Core flows, device modes, and pass/fail criteria.

## Home
- Device/mode: Desktop + Mobile, Light/Dark
- Steps: Load /, review hero, CTAs, featured sections.
- Pass: CTA hierarchy clear, no layout shifts, text wraps correctly.

## Atlas Simulator
- Device/mode: Desktop + Mobile, Light/Dark, Reduced Motion
- Steps: Open /atlas/simulator, fill tool + cwd, scan folder.
- Pass: Header stays stable, scan results render, no console warnings.
- Pass (mobile): Primary CTA is tappable above bottom nav + safe area (44px touch target).
- Pass (reduced motion): Entry animations suppressed or simplified.

## Workbench
- Device/mode: Desktop + Mobile, Light/Dark, Keyboard-only
- Steps: Open /workbench, add section, edit, compile, view output.
- Pass: Panels scroll correctly, focus visible, output updates.
- Pass (mobile): Bottom nav does not overlap primary CTA; editor remains usable with OSK open.
- Pass (reduced motion): Prefers-reduced-motion removes non-essential transitions.

## Library / Browse
- Device/mode: Desktop + Mobile, Light/Dark
- Steps: Open /library, apply filters, open preview drawer.
- Pass: Filters align, cards consistent, drawer readable.
- Pass (mobile): "Open in Workbench" CTA stays visible/tappable above bottom nav.

## Translate
- Device/mode: Desktop + Mobile, Light/Dark
- Steps: Open /translate, paste content, compile output.
- Pass: Inputs align, helper text visible, no overflow.
- Pass (mobile): Translate CTA remains tappable above safe area; output panel scrolls without overlap.

## Docs / Legal
- Device/mode: Desktop + Mobile, Light/Dark
- Steps: Open /docs, /privacy, /terms.
- Pass: Typography scale consistent, links readable, no overflow.

## Auth + Templates
- Device/mode: Desktop + Mobile, Light/Dark
- Steps: Open /signin, visit /templates.
- Pass: Form labels present, buttons reachable, no layout jumps.

## Diagnostics
- Device/mode: Desktop
- Steps: Open /tokens and /labs/city-logo.
- Pass: Pages load without errors; controls respond.
