# Current flow audit (baseline)

Last updated: Dec 20, 2025

## Primary entry points (today)
- Home: `/` (hero search + multiple CTAs)
- Library: `/library` (also reachable via `/browse` redirect)
- Workbench: `/workbench` (also reachable via `/builder` redirect)
- Atlas Simulator: `/atlas/simulator`
- Docs: `/docs`

## Current flow map (new visitor)
### Flow A: Home → Library → Workbench → Export
1. Land on `/`.
2. Scan hero area for CTA; options include “Browse library” + “Build in 60s” and other sections.
3. Click Browse → redirected to `/library`.
4. Filter/search; pick an item.
5. Choose from multiple row actions (Preview, Copy, Fork, Open Workbench).
6. Open Workbench; select Structure/Editor/Output tabs.
7. Export from Output panel.

#### Decision points / friction (Library)
- Multiple competing CTAs on home may obscure the primary path.
- Legacy `/builder` references appear across surfaces; prefer “Workbench” naming.
- Library rows present 3–4 actions with similar emphasis.
- Templates/Tags routes compete with Library and dilute discovery.
- Workbench has limited onboarding; empty states are terse and do not guide next action.

### Flow B: Home → Atlas Simulator → Workbench
1. Land on `/`.
2. Navigate to Atlas via nav or Atlas section (if noticed).
3. Go to Simulator, select tool + repo source.
4. Choose folder (or paste file paths) and run simulate.
5. Interpret loaded files + insights; manually proceed to Workbench.

#### Decision points / friction (Atlas Simulator)
- Simulator entry is not the primary CTA from home or nav.
- Manual input is equally weighted with folder scan, increasing complexity.
- Summary of outcomes is verbose; “next step” is not obvious.

### Flow C: Direct Workbench entry
1. Land on `/workbench` (legacy `/builder` redirect).
2. View Structure panel; only “Loading structure…” then Scopes/Blocks.
3. Output panel shows tabs but no explicit “first action.”

#### Decision points / friction (Workbench)
- Lack of a visible quick-start or guided path.
- Terms like “Scopes” and “Blocks” are not explained for new users.

## Journey map (condensed)

| Stage | User intent | Current UI signal | Gap |
| --- | --- | --- | --- |
| Discover | “What is this site for?” | Hero copy, feature blocks | Too many competing messages |
| Start | “What should I do first?” | Multiple CTAs | Primary action unclear |
| Learn | “How do tools read my instructions?” | Atlas Simulator | Entry not prominent; results not summarized |
| Build | “How do I assemble agents.md?” | Workbench panels | Minimal onboarding and empty-state guidance |
| Finish | “How do I export?” | Output/Export tab | Requires tab literacy; no single clear CTA |


## Pain points (prioritized)
1. **Primary task ambiguity**: Home and nav do not clearly signal “Scan folder → understand instructions → build/export.”
2. **Naming drift**: legacy `/builder` references vs Workbench vs Templates adds cognitive load.
3. **Action overload**: Library row CTAs compete for attention; no primary action.
4. **Simulator complexity**: Folder scan and manual entry appear equally prominent.
5. **Onboarding gaps**: Workbench uses technical terms without explanation.

## Hypotheses for simplification
- Make Atlas Simulator the top-level “Start here” CTA.
- Collapse Library filters and show “Advanced” for long-tail options.
- De-emphasize Templates/Tags routes in navigation; keep Library as the primary discovery entry.
- Add a 3-step quick-start card in Workbench with a single primary action.
- Consolidate redirects and ensure one naming system across UI and routes.

## Metrics to validate
- % of sessions with Scan Start event from home.
- Time-to-first-export from landing.
- CTR on primary CTA vs secondary.
- Drop-off between Simulator completion and Workbench open.
