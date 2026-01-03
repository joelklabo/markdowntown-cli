# UX clarity research synthesis

Last updated: Dec 20, 2025

## Goal
Simplify and clarify how new users should use mark downtown by prioritizing the primary flow (scan folder → understand instructions → build/export) and reducing cognitive overhead.

## Sources (for citation)
1. https://app.uxcel.com/lessons/tips-to-reduce-cognitive-load-387/use-progressive-disclosure-1595
2. https://www.uxpin.com/studio/blog/ux-best-practices-designing-the-overlooked-empty-states/
3. https://blog.logrocket.com/ux-design/empty-states-ux-examples/
4. https://ux.redhat.com/elements/call-to-action/guidelines/
5. https://uxmag.com/articles/designing-the-perfect-button
6. https://uxcel.com/blog/hicks-law-in-ux-design-simplifying-choices-for-faster-decisions

## Actionable principles (5–8)
1. Progressive disclosure reduces cognitive load by revealing advanced options only when needed.
   - Implication: Hide manual path entry and advanced filters behind a clear “Advanced” affordance, especially on mobile. [1]

2. Empty states should guide the next step with a visible action and short, actionable copy.
   - Implication: Replace passive empty messages with a primary CTA (e.g., “Scan a folder” or “Add your first block”). Sources: 2, 3.

3. One primary call to action per page improves clarity and reduces choice paralysis.
   - Implication: On the home page and key surfaces, establish a single primary CTA and demote secondary actions. Sources: 4, 5.

4. Reduce visible choices to speed decisions (Hick’s Law); prioritize essential options first.
   - Implication: Limit default filter sets and surface the most common targets/types; allow expansion for advanced filtering. [6]

5. Visual hierarchy must reinforce the primary task (CTA contrast, section order, whitespace).
   - Implication: Reorder sections so the primary flow appears first, and reduce competing blocks. Sources: 1, 5.

6. CTA semantics should match intent (links for navigation, buttons for actions) and remain consistent.
   - Implication: Standardize copy and styling so navigation always looks like navigation and actions look like actions. Sources: 4, 5.

7. Chunking and step-wise framing makes complex flows feel simpler.
   - Implication: Present the flow as 3–4 steps with clear verbs (Scan → Review → Build → Export). [1]

## Common pitfalls to avoid
- Hiding too much: advanced features should remain discoverable and clearly labeled.
- Multiple competing CTAs: more than one “primary” action can increase hesitation.
- Empty states without a next step: users will drop off if the screen doesn’t tell them what to do.
- Inconsistent naming (Builder vs Workbench) which fragments mental models.

## Research-to-UX hypotheses
1. A “Start here” CTA to Atlas Simulator will increase first meaningful actions (scan start).
2. Demoting secondary nav items will reduce navigation thrash on first session.
3. Library filters presented as “common” + “advanced” will increase time-to-result.
4. Workbench onboarding card will reduce “empty editor” confusion and increase export actions.

## Refactor/bug opportunities spotted (create tasks)
- Docs landing page should link to the new simplified user guide and primary flow.
- Navigation and route naming redundancy (/builder, /browse, /templates) should be consolidated.
