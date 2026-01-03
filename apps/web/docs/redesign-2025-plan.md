# mark downtown redesign 2025 plan

## Goals
- Make the interface feel calm, competent, and intelligent while reducing visual busyness.
- Guide first-time visitors to the value (why mark downtown, what you can build) within 10 seconds.
- Let returning users move from browse -> assemble -> export in one continuous, low-friction flow.
- Ship a design system that makes future components "fit in by default" across light and dark modes.

## Primary user stories
- New visitor: grasp what mark downtown does, view a credible example, and try building without account creation.
- Researcher: compare snippets/templates, save favorites, and understand popularity/quality signals quickly.
- Builder: assemble or edit an agents.md in a focused workbench with real-time feedback and AI assist.
- Returning pro: jump back into the last file, use shortcuts/command palette, and export or share confidently.

## Current pain
- Dense surfaces compete for attention; hierarchy is unclear.
- Motion/feedback is inconsistent; interactions sometimes feel brittle.
- Dark mode lacks parity; tokens aren't strong enough for dual themes.

## Three design directions

### 1) Calm Authority
Clean, editorial layouts with generous white space, restrained color, and decisive typography. Borrow Linear's recent "design reset" emphasis on clarity and systematic grouping for focus (Linear blog, 2024).  
**Visuals:** muted neutrals, a single accent, consistent 8pt rhythm, clear section dividers.  
**Motion:** minimal, purpose-led transitions; quick micro-interactions only for state change.  
**Dark mode:** high-contrast neutrals with soft highlights; no saturated backgrounds.  
**Best for:** credibility, dense documentation, enterprise trust.

### 2) Precision Workbench
An instrument-panel feel that signals power: split panes, data cards, syntax-aware surfaces, and scoped highlights. Uses structured grids and data viz techniques like Vercel's data design work (WebGL layers, crisp grids).  
**Visuals:** slate/graphite base, cyan/amber accents for status, thin grid lines, glassy panels.  
**Motion:** choreographed panel reveals and timeline scrubbing that follow Carbon's "distance determines duration" guidance.  
**Dark mode:** default-first; light mode inverts with warm grays and subtle shadows.  
**Best for:** builder/editor, analytics, pro shortcuts.

### 3) Playful Mentor
A friendlier, exploratory surface with tactile cards, gradient backdrops, and guided micro-tasks inspired by Framer's interactive templates.  
**Visuals:** soft pastels/duotones, rounded cards, iconography with personality.  
**Motion:** "delight pings" on completion, staggered reveals on browse, playful cursor/hover hints.  
**Dark mode:** colorful accents on deep navy/charcoal; maintain WCAG contrast.  
**Best for:** onboarding, education, marketing moments.

## Chosen direction (blend)
- **Foundation:** Calm Authority for readability and trust.
- **Work surfaces:** Precision Workbench for builder/library flows.
- **Onboarding & delight:** Playful Mentor micro-moments to humanize without clutter.

## Design System 2.0 blueprint
- **Tokens:** dual light/dark palettes; semantic roles (surface, overlay, brand, info, success, warning, danger); motion tokens (duration, easing, distance-based); spacing/size scale (4/8); elevation levels; border radii that vary by component class.  
- **Typography:** Replace default with humanist sans + mono pair; define display/h1-h6/body/label/mono styles and letter/line scales.  
- **Iconography & illustration:** Two weights (outline/solid) with consistent stroke; minimal accent illustration set for onboarding.  
- **Grid & layout:** 12-column, 1440px max width for marketing; 2-3 pane adaptive grid for builder (sidebar 280-320px); mobile first breakpoints at 480/768/1024/1280.  
- **Components:** Buttons, inputs, selects, textarea, search field, tabs, pills, cards, banners, toasts, command palette, pagination, breadcrumbs, data chips, stats, charts shells, modal/sheet, stepper, empty states.  
- **Patterns:** Navigation (desktop + mobile), search/browse with filters, card gallery, detail page with secondary actions, builder workbench, AI assist prompt area, onboarding checklist, notification pattern, settings forms.  
- **Motion rules:** Follow Carbon guidance-motion length tied to travel distance, easing tuned per component tier, disable for reduced-motion.  
- **Theming:** Single source tokens in `tailwind.config.ts`; theme provider for light/dark; docs page showing live token switch.  
- **Content design:** Voice and tone guidelines; microcopy library for success/error/empty; glossary of core terms.

## Build plan (task-by-task)
### Phase 0 - Alignment
- Validate goals with stakeholders; freeze scope and success metrics.
- Select final typefaces and palette drafts; build mood boards per direction.

### Phase 1 - System foundations
- Expand tokens (color roles, typography, spacing, radius, shadow, motion).  
- Implement theme provider + light/dark tokens.  
- Add Storybook/MDX playground for tokens and primitives.  
- Rebuild primitives: Button, IconButton, Input, Select, Textarea, Checkbox/Radio, Tooltip, Badge/Pill, Card, Tag, Avatar, Tabs, Breadcrumbs, Pagination.  
- Add utility classes: text styles, grid helpers, focus rings, elevated surfaces.  
- Document content guidelines and copy tokens (title, lead, helper, meta).

### Phase 2 - Navigation & IA
- Redefine global nav and footer; add command palette entry points.  
- Mobile navigation with search-first sheet and quick filters.  
- Update information architecture map; ensure URL and breadcrumb consistency.

### Phase 3 - Core experiences
- Landing: new hero, proof modules, "build in 60s" guided path, social proof.  
- Library/browse: faceted filters, tag chips, quality signals, inline preview, keyboard shortcuts.  
- Detail pages (snippet/template): dual view (rendered/raw), stats, related, CTAs.  
- Builder/workbench: 3-pane layout, drag/snap grid, AI assist zone, timeline of changes, status strip.  
- Onboarding flow: checklist with playful micro-interactions; sample project load.  
- Export/share: clearer affordances, success states, copy/download toasts.

### Phase 4 - Motion & interactivity
- Define motion presets per component tier; add reduced-motion fallbacks.  
- Hero and gallery animations (lightweight, LCP-safe); streaming previews.  
- Micro-feedback: loading skeletons, optimistic updates, hover depth, active filters.  
- Data viz kit for stats/usage cards (sparkline, bar, radial).

### Phase 5 - Content, accessibility, performance
- Rewrite key pages' copy; add voice/tone checklist.  
- a11y pass: color contrast, focus order, ARIA for nav/search/builder.  
- Perf budget per page; LCP/TTFB dashboards; skeletons and suspense usage.

### Phase 6 - QA, docs, rollout
- Visual regression suite (Playwright per breakpoint); interaction smoke.  
- Update DESIGN_SYSTEM.md and create adoption playbook.  
- Migration checklist for teams adopting new components.  
- Launch comms: changelog, in-product highlights, feedback loops.

## Full task list (for issue creation)
- Foundations: token expansion, motion tokens, typography swap, light/dark themes, documentation page, lint rule to forbid raw hex, Storybook setup, component primitives build-out (10+), utility classes, icon set audit.  
- Navigation/IA: nav redesign, mobile nav/search sheet, footer refresh, breadcrumb system, URL/metadata audit, command palette wiring.  
- Landing & marketing: hero redesign, social proof module, "build in 60s" flow, feature grid, CTA experiments, SEO/meta refresh.  
- Library: faceted filters, tag chips, sort controls, quality signals (views/copies/recency), inline preview, keyboard shortcuts, pagination, empty states, analytics events.  
- Detail pages: rendered/raw toggle, stats strip, related content, copy/download improvements, share/export modals.  
- Builder/workbench: 3-pane responsive grid, drag/drop + snap, outline panel, AI assist slot, timeline/versions, status strip, error/success toasts, autosave/skeletons.  
- Onboarding/playful: checklist component, sample project loader, celebratory animations, contextual tips, progress tracker.  
- Motion/interactions: define presets, reduced-motion support, hero/galleries animations, loading skeletons, hover/pressed states, optimistic update patterns.  
- Data viz kit: tokenized chart colors, sparkline/mini bar components, empty/error states.  
- Content: voice/tone guide, microcopy library, glossary, empty/zero/blank templates.  
- Accessibility & performance: contrast audit fixes, focus management, aria labels, perf budgets per route, LCP/CLS instrumentation.  
- QA & documentation: visual regression tests, interaction smoke tests, DESIGN_SYSTEM.md update, adoption guide, migration playbook, changelog entries, in-product "what's new".

## Inspiration sources
- Linear design reset parts I & II focus on clarity and grouping to reduce clutter (Linear blog, 2024).  
- Carbon motion guideline: duration tied to travel distance; motion as personality when purposeful.  
- Vercel data design article: layering WebGL grids to improve data-heavy visuals.  
- Framer template marketplace shows interactive, tactile hero/section patterns.  
