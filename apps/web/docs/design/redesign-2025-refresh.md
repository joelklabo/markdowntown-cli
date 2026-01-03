# MarkdownTown Redesign 2025 Refresh

Date: 2025-12-03  
Author: honk  

## Core user stories
- New visitor: grasp value in <10s, preview credibility, try builder without signup.
- Returning builder: reopen last work, add snippets/templates fast, export confidently.
- Researcher: scan library quality signals, filter by tags/models, copy or save trusted items.
- Team lead: assess security/brand polish (CSP, rate limits, a11y), feel the product is competent.

## Current pain
- Visual busyness and competing modules dilute hierarchy.
- Motion inconsistent; dark mode lacks parity.
- Library and builder feel utility-first, not confidence-inspiring.

## Three design directions
### 1) Calm Authority (Landing & docs surfaces)
Minimal layout, generous whitespace, monochrome + single accent, decisive typography; motion only for state change. Mirrors Calm/Linear clarity and minimalist 2025 trends.
Dark mode: charcoal bases, soft contrast accents; keep CTAs vivid but limited.  
Interactivity: hover depth, scroll markers, sticky nav with reduced clutter.

### 2) Precision Workbench (Builder & library)
Instrument-panel feel: split panes, gridlines, syntax-aware highlights, data chips. Inspired by developer/tool UIs and conceptual blending workflows that keep structure crisp.
Dark-mode first with cyan/amber status tokens; glassy panels for focus; motion tied to distance to reinforce competence.

### 3) Playful Mentor (Onboarding & micro-moments)
Tactile cards, staggered reveals, friendly copy; scrollytelling for “build in 60s”. Draws from interactive onboarding examples and scrollytelling patterns.
Dark mode: deep navy with neon accents; animations short, LCP-safe; confetti/toast micro-delight on completion.

## Chosen blend
- Default brand frame: Calm Authority for marketing/docs.
- Core flows (browse/builder): Precision Workbench.
- Onboarding highlights: Playful Mentor micro-motions only where they aid comprehension.

## Design system 2.0 (light/dark)
- Tokens: semantic colors (surface/overlay/brand/info/success/warn/danger), typography scale, spacing 4/8, radius tiers, elevation, motion (distance-based durations), data-viz palette.
- Components: Buttons, IconButton, Inputs, Selects, Textarea, Checkbox/Radio, Tooltip, Badge/Pill, Card, Tag/Chips, Tabs, Pagination, Breadcrumbs, Modal/Sheet, Toast, Stepper, Command Palette, Search field, Stat chips, Sparkline/Bar/Radial shells.
- Patterns: Global nav/footer, search+filters, library cards, detail rendered/raw toggle, builder 3-pane, onboarding checklist, feedback banner, settings forms, QA baselines (visual + a11y).
- Theming: single token source; preview page with live light/dark toggle.
- Content design: voice/tone guide, microcopy library, glossary, error/success patterns.

## Build plan (phased tasks)
### Phase 0 – Alignment
- Approve goals, KPIs, typography pair, palette, motion tone boards.

### Phase 1 – System Foundations
- Expand tokens (light/dark, motion, data-viz); set lint rule to ban raw hex.
- Theme provider + token docs page.
- Rebuild primitives + utility classes; Storybook/MDX playground.

### Phase 2 – Navigation & IA
- Desktop nav + footer refresh; mobile nav/search sheet.
- Command palette entry points; breadcrumb/metadata audit.

### Phase 3 – Core Experiences
- Landing refresh (hero, proof module, “build in 60s”, social proof).  
- Library: faceted filters, sorts, inline preview, keyboard shortcuts, trust signals.  
- Detail pages: rendered/raw tabs, stats strip, related, copy/download/share.  
- Builder: 3-pane grid, live render via API, overrides, status strip, save/export.  
- Onboarding: checklist, sample project loader, inline tips.

### Phase 4 – Motion & Interactivity
- Motion presets per component tier; reduced-motion path.  
- Hero/galleries staggered reveals; micro-feedback (hover/pressed, optimistic states).

### Phase 5 – Content, A11y, Performance
- Rewrite key copy; tone checklist.  
- Contrast/focus/ARIA audit; keyboard paths.  
- Perf budgets per route; LCP/CLS monitors; skeletons/suspense.

### Phase 6 – QA, Docs, Rollout
- Visual regression baselines (Playwright per breakpoint).  
- Interaction smokes; DESIGN_SYSTEM.md update; adoption playbook; migration guide.  
- Launch comms + in-product “What’s new”.

## Full task list (issue-ready)
- Foundations: token expansion; motion tokens; data-viz palette; lint rule no hex; theme provider; token docs page; Storybook; primitives (12 listed); utility classes.
- Navigation/IA: desktop nav/footer; mobile nav/search; breadcrumb system; command palette links; metadata/URL audit.
- Landing: hero redesign; proof grid; “build in 60s” flow; feature grid; social proof; SEO/meta refresh.
- Library: faceted filters; tag chips; sort; quality signals (views/copies/recency); inline preview; keyboard shortcuts; pagination/empty states; analytics events.
- Detail pages: rendered/raw toggle; stats strip; related content; copy/download/share; warnings for private/unlisted; feedback CTA.
- Builder: 3-pane layout; template/snippet add; overrides editor; live render API hook; save/export flows; status strip; autosave; error/success toasts; reduced-motion handling.
- Onboarding: checklist; sample loader; contextual tips; celebratory animations; progress tracker.
- Motion: preset library; reduced-motion support; hero/gallery animations; hover/pressed states; loading skeletons; optimistic updates.
- Data viz kit: sparkline/bar/radial components; empty/error states; color tokens.
- Content: voice/tone guide; microcopy library; glossary; empty/zero-state templates.
- A11y & perf: contrast fixes; focus order; aria labels; perf budgets; LCP/CLS instrumentation.
- QA/docs: visual baselines; interaction smokes; DESIGN_SYSTEM update; adoption playbook; migration guide; changelog + what’s new banner.

## Implementation notes
- Animation budget: keep hero LCP-friendly, prefer transform/opacity.
- Dark mode parity required for every component/pattern.
- Analytics: events for browse/filter, builder steps, exports, saves.
- Security: CSP, rate limits, markdown sanitization already in place; keep caches Vary: Cookie.
