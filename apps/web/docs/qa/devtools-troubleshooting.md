# DevTools MCP troubleshooting

## Symptoms
- MCP attach fails with `Network.enable timed out`.
- DevTools MCP page hangs while opening a target.
- Console/network capture never loads, or loads partially.

## Likely causes
- Dev server is still compiling or stuck after `EMFILE` watch errors.
- Multiple MCP DevTools pages are open against the same target.
- MCP bridge/agent restarted mid-session.
- Browser session lost its DevTools target.

## Triage steps (in order)
1. Confirm the app responds:
   - `curl -I http://localhost:3000`
2. Run the MCP health probe:
   - `npm run mcp:health`
   - If slow, retry with higher timeout: `MCP_HEALTH_TIMEOUT=3000 MCP_HEALTH_RETRIES=3 npm run mcp:health`
3. Close any existing MCP DevTools pages/tabs.
4. Restart the MCP bridge/agent, then re-open a fresh DevTools page.
5. If the dev server logged `EMFILE`, restart with polling:
   - `WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 npm run dev`
6. Retry the DevTools capture.

## Fallback evidence
If MCP still fails, capture QA evidence with the Playwright fallback:
- `node scripts/qa/devtools-smoke.mjs --url http://127.0.0.1:3000 --health 1 --retries 2`

## What to record
- Exact MCP error text (including `Network.enable timed out`).
- Output of `npm run mcp:health`.
- Whether `WATCHPACK_POLLING` was enabled.
- Dev server log excerpt from `/tmp/markdowntown-dev.log`.
