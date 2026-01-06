# Dev workflow (nostrstack)

## Required log visibility
- Use `pnpm dev:logs` (wrapper for `scripts/dev-logs.sh`) or `make dev`.
- Logs are written to `.logs/dev/api.log` and `.logs/dev/gallery.log`.
- Keep a tail running while reproducing/fixing: `tail -f .logs/dev/api.log .logs/dev/gallery.log`.

## UI verification (required for UI changes)
- Start MCP server: `./scripts/mcp-devtools-server.sh`.
- Start Chrome with remote debugging: `./scripts/mcp-chrome.sh`.
- Open the modified view, verify console/network clean, capture screenshot if needed.
- If MCP fails (e.g., `Transport closed`), run `pnpm qa:regtest-demo` instead.

## Notes
- `make dev` also brings up regtest stack (bitcoind + lnd-merchant + lnd-payer + LNbits) and exports LNbits env vars.
- Telemetry websocket: gallery connects to `wss://<host>/ws/telemetry`; Vite proxy must forward to API in dev.
