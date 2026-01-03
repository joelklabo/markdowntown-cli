# Onboarding & Playful Moments (Dec 2025)

## Objectives
- Help new users try the builder within 60 seconds.
- Make successes feel rewarding without cluttering calm visuals.
- Keep flows accessible and keyboard-friendly; honor reduced motion.

## Components/patterns
- **Checklist**: small docked card with 3 steps (Search → Add to builder → Export). Persist completion in localStorage.
- **Sample loader**: “Load sample agents.md” button loads a curated template + 3 snippets.
- **Context tips**: inline hint chips near search, builder outline, and copy/export buttons; dismissible.
- **Celebration**: confetti/light pulse on first copy/export; toast on checklist completion.
- **Progress strip**: top of builder shows step progress (uses Badge + motion preset).

## Motion rules
- Micro tier for tips/hover; panel tier for checklist open/close.
- Respect `prefers-reduced-motion`: swap confetti for static badge, avoid translate animations.

## Acceptance
- Works in light/dark; keyboard accessible; reduced-motion tested.
- Local state persists completion; sample loader avoids overwriting user work without confirm.
- Analytics events: `onboarding_checklist_step`, `onboarding_sample_load`, `onboarding_celebrate`.
