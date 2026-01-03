# Codex skill voice + structure

## Tone
- Direct, calm, and technical.
- Use imperative verbs ("Run", "Check", "Verify").
- Keep sentences short; avoid filler.
- Prefer numbered steps for multi-action procedures.
- Use bullets for checklists and guardrails.

## Progressive disclosure
- Start with the minimum steps to complete the task.
- Add "If needed" sections for optional or edge-case steps.
- Avoid dumping full docs; link to references instead.

## Preferred SKILL.md structure
1. **Name + short description**
2. **Trigger phrases** (what should invoke the skill)
3. **When to use** (one paragraph)
4. **Steps** (numbered list)
5. **Guardrails** (do not do / safety constraints)
6. **References** (links to repo docs or source files)

## Example skeleton
```md
# Skill: <name>

Short description of what this skill helps with.

## Triggers
- "<phrase>"
- "<phrase>"

## When to use
Use this skill when...

## Steps
1. ...
2. ...

## Guardrails
- Do not ...
- Avoid ...

## References
- docs/...
- src/...
```

## Do
- Use repository terms (Workbench, Atlas, UAM, adapters).
- Cite exact commands and file paths.
- Call out required tests.

## Do not
- Add generic advice unrelated to the repo.
- Include long prose or marketing language.
- Assume network access or secrets.

## Reference docs
- docs/DEV_ONBOARDING.md
- docs/BEADS.md
- docs/DESIGN_SYSTEM.md
- docs/ux/primary-flow-spec.md
- docs/design/motion-responsive.md
