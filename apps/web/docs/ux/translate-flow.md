# Translate flow spec

Date: 2025-12-28
Owner: UX

## Objective
Provide a fast, low-friction path from pasted instructions to Workbench so users can export agents.md with confidence.

## Primary flow (happy path)
1. **Select target(s)**
   - Default targets: AGENTS.md + GitHub Copilot.
   - Users can toggle targets on/off and expand Advanced options for adapter versions + target-specific options.
2. **Paste input**
   - Accept Markdown or UAM JSON.
   - Detect input type and surface a “Detected: Markdown/UAM v1” badge.
3. **Translate**
   - Primary CTA is “Translate”.
   - While translating, disable the CTA and prevent double-submit.
   - On success, show a short summary of generated outputs.
4. **Open in Workbench**
   - Primary CTA becomes “Open in Workbench”.
   - Workbench opens with translated files ready to export.
   - Handoff uses a transient client-side channel (URL params for small payloads; session storage for larger payloads). If the payload exceeds safe client limits, show a fallback guidance message and offer download/copy.
5. **Export**
   - Users export or copy agents.md in Workbench.

## CTA hierarchy
- **Primary:** Translate → Open in Workbench
- **Secondary:** Advanced options toggle
- **Tertiary:** Download zip (optional fallback only)

## Validation + error states
- **No targets selected:** Disable Translate and show “Select a target”.
- **Empty input:** Disable Translate; keep results empty.
- **Input too large (>200k chars):** Block translate with “Input is too large to convert.”
- **Invalid advanced options JSON:** Inline error “Invalid JSON options”.
- **API/compile error:** Show error message in Output panel with a single retry action.
- **Timeout:** If the request exceeds the client timeout, show a retry CTA with guidance to try a smaller input or fewer targets.

## Target selection rules
- Targets are required to translate; at least one must be selected.
- Advanced options allow adapter version overrides and per-target options JSON.
- When multiple targets are selected, Workbench opens with multiple files.

## Edge cases
- Example query params can prefill input; missing examples show an inline error.
- UAM JSON detection should prefer valid UAM v1 over generic JSON.
- Large inputs warn at 50k chars and hard-stop at 200k chars.
- Provide a clear/reset action for large pasted inputs to restart quickly.

## Copy + terminology
- Use “Translate” as the surface label.
- Use **AGENTS.md** for repo instruction file and **agents.md** for exported output.
- Confirm destination: “Opens in Workbench for export.”
- Avoid “Compile” in user-facing copy; align with microcopy guidelines.

## References
- docs/ux/microcopy-guidelines.md
- docs/ux/primary-flow-spec.md
