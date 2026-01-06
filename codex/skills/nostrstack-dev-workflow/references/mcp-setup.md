# MCP Chrome DevTools setup (summary)

## Start
- Chrome: `./scripts/mcp-chrome.sh` (port 9222).
- MCP server: `./scripts/mcp-devtools-server.sh`.

## If MCP tools fail with `Transport closed`
1) Ensure `~/.codex/config.toml` enables `rmcp_client = true`.
2) Verify Chrome debugging port: `lsof -nP -iTCP:9222 -sTCP:LISTEN`.
3) Re-add MCP server:
   - `codex mcp remove chrome-devtools`
   - `codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --browserUrl=http://127.0.0.1:9222 --acceptInsecureCerts`

## Targets
- Gallery: `http://localhost:4173`
- API: `http://localhost:3001`
