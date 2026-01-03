# QA video capture (scan flow)

Use this guide to record scan → workbench → export videos for QA evidence.

## Prereqs
- Start the dev server with polling to avoid watchpack `EMFILE` and route 404s:
  ```bash
  WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 pnpm dev
  ```
- Ensure the scan flow flags are enabled for Next steps:
  ```bash
  NEXT_PUBLIC_SCAN_NEXT_STEPS_V1=1
  NEXT_PUBLIC_SCAN_QUICK_UPLOAD_V1=1
  ```

## Record the videos
Use the scripted recorder (captures desktop, mobile, and recovery flows):
```bash
E2E_BASE_URL=http://localhost:3000 \
E2E_VIDEO_HEADLESS=0 \
node scripts/qa/record-scan-flow-videos.mjs
```

Outputs land in:
- `docs/qa/videos/scan-flow/flow-1-desktop.mp4`
- `docs/qa/videos/scan-flow/flow-2-mobile.mp4`
- `docs/qa/videos/scan-flow/flow-3-recovery.mp4`

## Environment variables
- `E2E_BASE_URL`: dev server URL (default: `http://localhost:3000`).
- `E2E_VIDEO_HEADLESS`: set `0` to watch the run, `1` for headless recording.
- `WATCHPACK_POLLING`, `WATCHPACK_POLLING_INTERVAL`: keep the dev server stable during video capture.

## Troubleshooting
- Mobile tab switching fails: rerun with `E2E_VIDEO_HEADLESS=0` and slow down the flow; confirm the bottom nav is visible before tapping tabs.
- MCP timeouts: capture the exact MCP error text and proceed with the video run; note timeouts in QA evidence.
- 404s during recording: verify the polling dev server is still running and `curl -I http://localhost:3000` returns 200.
