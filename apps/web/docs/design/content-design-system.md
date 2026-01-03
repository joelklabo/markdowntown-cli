# Content Design System (Dec 2025)

## Voice & tone
- **Voice:** Confident, concise, calm. Avoid hype; explain benefits plainly.
- **Tone by context:** Success (warm, brief), Error (direct, helpful), Empty (encouraging, suggest next action), Loading (set expectations).
- Prefer verbs over nouns (“Copy”, “Start build”, “View template”).

## Microcopy library (examples)
- Primary CTAs: “Start guided build”, “Browse library”, “Copy snippet”, “Download agents.md”.
- Errors: “Save failed—check connection and try again.” / “Tags need letters, numbers, or hyphens.”
- Empty states: “No results yet. Try fewer tags or clear filters.” / “Add your first section to see preview.”
- Success: “Copied to clipboard”, “Saved”, “Sample loaded”.
- Onboarding tips: “Load a sample to see how it’s structured.” / “Drag to reorder; arrow keys to nudge.”

## Labels & capitalization
- Sentence case for headings and buttons.
- Keep labels ≤ 3 words; helper text goes below.
- Avoid jargon; spell out keyboard shortcuts in tooltips (e.g., “Cmd/Ctrl + K”).

## Structural patterns
- Titles: one idea per line; support with a single lead sentence.
- Lists: keep to 3–5 bullets; use verbs.
- Stats: show units; pair numbers with trend when available.

## Strings ownership
- Centralize strings in code: export constants from `src/lib/strings.ts` to reduce drift.
- Keep component defaults in English; localize-ready by avoiding string concatenation.

## Acceptance
- Every new UI copy uses library strings or follows the tone rules.
- Error/success/empty states present; aria labels set for icons/toggles.
- Dual-mode reviewed (light/dark); max width respected for body text.
