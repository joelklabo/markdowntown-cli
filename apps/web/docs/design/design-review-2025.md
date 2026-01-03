# MarkdownTown Design Refresh – December 2025

> Note: Current product name is **“mark downtown”** (repo: `markdowntown`, domain: `markdown.town`).  
> Wordmark spec: `docs/design/wordmark-voxel-cityscape.md`.

## User stories (top)
- New visitor: understand value and trust in <10s; see a credible example; try building without sign-in.
- Returning pro: jump to last project, use keyboard/palette, export confidently.
- Researcher: compare snippets/templates quickly; see quality signals (copies/views/recency).
- Builder: focused 3-pane workbench with status/ai assist; fast save/copy/export.

## Three design proposals
### 1) Calm Authority
- Editorial layout, generous whitespace, restrained palette, decisive type.
- Minimal motion (only state change), strong grid, content-first.
- Dark mode: neutral charcoal with soft highlights.

### 2) Precision Workbench
- Instrument-panel feel: split panes, gridlines, data chips, status strip.
- Motion tied to distance (Carbon guidance) and purposeful reveals.
- Dark-default with cyan/amber accents; light mode flips to warm grays.

### 3) Playful Mentor
- Tactile cards, gradients, guided checklists, celebratory micro-moments.
- Interactive hovers, template previews, starter projects.
- Dark mode keeps saturation but on deep navy for contrast.

## Web inspiration (Dec 3, 2025)
- Carbon motion: duration scales with travel distance. citeturn0search0
- Framer templates showing polished micro-interactions (Spotlight, Monica Ellis, Art&Objects). citeturn0search3turn0search1turn0search2
- Framer marketplace trend toward high-craft, low-clutter templates with subtle animation. citeturn0reddit14turn0reddit12

## Chosen blend
- Base = Calm Authority for credibility.
- Builder/library = Precision Workbench for pro feel.
- Onboarding/delight = Playful Mentor micro-moments (checklists, confetti-on-copy).

## Living City alignment (Dec 20, 2025)
- The header wordmark is a full-bleed visual anchor; nav surfaces should float cleanly above it without competing textures.
- Use semantic tokens to pull subtle accents from the header (primary/soft surfaces) while preserving legibility and professional tone.
- Page rhythm targets: `py-mdt-10 md:py-mdt-12`, primary stacks `gap={8}`, cards `p-mdt-5` + `space-y-mdt-3`.
- Tabs and segmented pickers should follow the shared pill pattern (≥ 40px height, clear active state, visible focus ring).

## Design system 2.0 (light/dark)
- Tokens: expanded semantic colors, radii, shadows, motion (distance-based), spacing scale; dual themes in `globals.css`.
- Typography: humanist sans + mono; defined display/h1–h6/body/label/mono styles.
- Components: Buttons/IconButton/Input/Select/Textarea/Checkbox/Radio/Tooltip/Tabs/Card/Pill/Badge/Tag/Avatar/Pagination/Drawer/Breadcrumb/Command palette.
- Patterns: nav (desktop/mobile), search sheet, faceted browse, detail pages with quality strip, builder 3-pane, onboarding checklist, toasts/notifications, empty/error states, data viz mini-kit (sparkline/mini-bar).
- Motion rules: tiered presets (micro/component/panel), distance-tied duration, reduced-motion fallback.
- Content: voice/tone guide, microcopy library, glossary.

## Build plan (task list)
1. Foundations: finalize palettes (light/dark), type pair, motion tokens, spacing; document in Storybook + docs.
2. Nav/IA: polish desktop nav, mobile sheet, footer links; breadcrumbs consistent.
3. Landing: calm hero, “build in 60s” guided path, social proof, CTA experiments, SEO/meta.
4. Browse: faceted filters (type/sort/tags), result count strip, keyboard support, inline preview, quality badges, empty state.
5. Detail pages: snippet/template with quality strip (views/copies/votes), rendered/raw tabs, related content, improved share/copy/export.
6. Builder 3-pane: outline/editor/preview cards with status badges, autosave feedback, drag/snap, AI assist slot, reduced-motion option.
7. Onboarding: checklist, sample project loader, contextual tips, celebratory states.
8. Motion system: implement presets hook + utilities; audit components for duration/ease/distance; add reduced-motion guardrails.
9. Data viz mini-kit: tokenized sparkline/bar/donut stubs for stats cards.
10. Content system: tone guidance, microcopy library, standardized labels for actions/errors.
11. Accessibility/perf: contrast fixes, focus order, aria labels; perf budgets per route; telemetry hooks.
12. Visual regression + smoke: Playwright baselines per breakpoint for nav/browse/builder/detail; interaction smoke.
13. Adoption playbook: migration steps, dos/don’ts, lint rules (no hex), examples.
14. Launch comms: changelog, in-product highlights, feedback loop.

## Dependencies (high level)
- Foundations → components → nav/landing/browse/detail/builder.
- Motion + content systems apply after components.
- QA/visual regression after core flows.
- Launch comms last.

## Files updated/related
- Tokens + themes: `src/app/globals.css`, `tailwind.config.ts`
- Motion presets: `src/components/motion/useMotionPreset.ts`
- Stories: `src/stories/*`
- Docs: this file; `docs/design/system-adoption-playbook.md`; `docs/design/motion-presets.md`
