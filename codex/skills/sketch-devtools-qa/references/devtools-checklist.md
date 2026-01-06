# DevTools QA Checklist (Sketch Magic)

## Console
- [ ] No **console errors** during the full flow.
- [ ] Warnings are either fixed or explicitly documented.
- [ ] Ignore expected dev-only messages (e.g., React DevTools prompt).
- [ ] Hydration errors or image src warnings are **blockers**.

## Network
- [ ] `/api/convert` returns **200** in the happy path.
- [ ] No 4xx/5xx errors for upload, preview, or convert.
- [ ] Confirm request payload includes sketch + prompt + provider.

## Performance
- [ ] Convert action shows immediate loading feedback.
- [ ] UI remains responsive during generation.
- [ ] No long main-thread stalls while waiting for results.

## Logs
- [ ] Tail server logs or use `pnpm dev:logs`.
- [ ] Confirm no runtime errors in `/api/convert`.
- [ ] If telemetry enabled, confirm timing/error events appear.

## Evidence to Capture
- Screenshot of Console (clean) after the flow.
- Screenshot of Network entry for `/api/convert`.
- Note viewport sizes used (320/390 widths).
