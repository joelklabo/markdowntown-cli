# Kid-First UX QA Checklist

Use this checklist during manual QA (Chrome DevTools + mobile devices). The goal is a calm, obvious flow for 4–5 year olds and caregivers.

## Viewports to Check
- **Mobile:** 320×700 and 390×844
- **Short screens:** 320×568 (ensure CTAs are not blocked)
- **Desktop:** 1024×768 (layout balance)

## Tap Targets + Inputs
- [ ] Primary actions are **≥ 44×44px** (Convert, Upload, Sample buttons, Download).
- [ ] Tap targets have **generous spacing**; no accidental taps.
- [ ] Tap targets visually look tappable (border, hover/active states).
- [ ] Inputs + buttons respond to keyboard (Enter/Space) and touch.

## Readability + Copy
- [ ] Headers and CTA labels are **large and short**.
- [ ] Instruction text is **1–2 sentences max**.
- [ ] Errors are friendly, non-technical, and actionable.
- [ ] Parent-only options (provider, prompt lab) are tucked away or clearly labeled.

## Motion + Feedback
- [ ] Loading state is visible **within 300ms** of tapping Convert.
- [ ] Convert button disables while loading and explains “wait” in kid-safe copy.
- [ ] **Reduced motion** is respected if enabled.
- [ ] No jarring animations or flashes.

## Contrast + Color
- [ ] Text contrast remains readable on the gradient background.
- [ ] Focus outlines are visible when tabbing.
- [ ] Error states are visible without relying on color alone.

## Layout + Flow
- [ ] The flow reads **top to bottom** (Upload → Style → Convert → Result).
- [ ] Results appear in the same area each time.
- [ ] No layout jumps that push CTAs off-screen.
- [ ] Safe-area padding is respected on notched devices.

## Error + Empty States
- [ ] Upload errors show a clear fix (try another file / pick a sample).
- [ ] Convert errors show “Try again” and keep the previous image visible.
- [ ] Preview errors show a gentle fallback message.

## Accessibility Toggles
- [ ] VoiceOver/Screen Reader names are meaningful.
- [ ] Buttons announce their purpose (e.g., “Upload drawing”).
- [ ] No critical info is in placeholder-only text.

## Final Kid Test
- [ ] A 4–5 year old can complete the flow with only a quick verbal cue.
- [ ] Child can find and tap Convert without help.
- [ ] Parent can safely access prompt/provider controls.
