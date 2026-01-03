# Microcopy guidelines (tone + CTAs)

Last updated: Dec 20, 2025

## Voice and tone
- Direct, calm, and action-oriented.
- Explain what happens next in plain language.
- Use short sentences and avoid internal jargon.

## Core terminology
- Use **agents.md** for the output file.
- Use **AGENTS.md** only when referencing the repo file name.
- Use **instruction files** as the umbrella term for AGENTS.md, tool files, and other inputs.
- Prefer **Scan**, **Workbench**, **Library**, **Translate**, **Docs** in labels.
- Avoid legacy labels like "builder" and "browse" in user-facing copy.

## CTA hierarchy
- **Primary CTA**: one per surface, describes the next action.
  - Examples: "Scan a folder", "Open Workbench", "Export agents.md".
- **Secondary CTA**: supports the primary action without competing.
  - Examples: "Browse Library", "Learn how it works".
- **Tertiary CTA**: link-style or subtle helper actions.
  - Examples: "View docs", "See examples".

## Surface-specific guidance
- **Home**: emphasize the scan-first flow.
  - Lead: "Scan a folder to see which instructions load."
- **Atlas Simulator**: explain outcomes and the next step.
  - Lead: "Preview which instruction files a tool would load."
  - Next step CTA: "Open Workbench".
- **Workbench**: reinforce progress toward export.
  - Lead: "Build your agents.md."
  - Helper: "Add scopes and blocks, then export."
  - With scan: "Scan defaults applied."
  - Without scan: "No scan context yet. Scan a folder to prefill Workbench."
  - Export CTA: "Export agents.md".

## Error and empty states
- Start with what happened, then the fix.
- Provide a single next action.
- Examples:
  - "No instruction files found. Add an AGENTS.md or agents.md and scan again."
  - "We could not read this folder. Check permissions and try again."

## Length and formatting
- Buttons: 2-4 words, verb-first.
- Headings: 3-7 words, sentence case.
- Helper text: max 1-2 short sentences.
- Avoid double punctuation and all-caps warnings.
