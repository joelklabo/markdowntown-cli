# Navigation & Header Rewrite (Public-First)
Date: 2025-12-01  
Issue: markdowntown-7z8.24

## Goals
- Header that prioritizes discovery: Browse, Templates, Builder, Tags, search.
- Keep auth cluster lightweight; ensure CTAs (“Use a template”, “Start building”) are prominent.
- Mobile-friendly: simplified top bar + optional bottom nav.

## Header layout (desktop)
- Left: Brand logo → `/`.
- Center nav links: Browse, Templates, Tags, Builder, Docs.
- Inline search input (⌘/ shortcut) with placeholder “Search snippets, templates…”.
- Right cluster: primary CTA button “Use a template” (or “Start building”), secondary “Sign in” or avatar dropdown.
- Sticky on scroll; slight elevation/shadow.

## Mobile layout
- Top bar: logo + search icon + avatar/sign-in.
- Bottom nav (optional): Home, Browse, Templates, Builder.
- Hamburger for secondary links (Docs, Changelog, Privacy).

## States
- Anon: show Sign in button; gated actions show lock icons.
- Authed: avatar menu with Favorites, My snippets/templates/files, Settings, Sign out.

## Interaction
- Search opens modal on mobile; inline typeahead on desktop.
- CTA should scroll to template rail on landing when on `/`.
- Nav highlights current section; use subtle underline/indicator.

## Accessibility
- Focus ring on nav links/buttons; maintain 4.5:1 contrast.
- Keyboard: tab order left→right; search focuses with `/` or `⌘/`.

## Implementation checklist
- [ ] Update layout component header to new nav structure.
- [ ] Add mobile top bar + optional bottom nav; hide bottom nav on desktop.
- [ ] Add search trigger icon/modal for mobile, inline input for desktop.
- [ ] Wire CTA to /templates or scroll to template module on landing.
- [ ] Ensure sticky behavior + shadow; respects theme toggle.
- [ ] Tests/QA: keyboard nav, focus rings, mobile breakpoint rendering.
