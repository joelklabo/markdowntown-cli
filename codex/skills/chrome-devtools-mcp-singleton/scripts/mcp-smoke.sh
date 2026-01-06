#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SCRIPT="$SCRIPT_DIR/run_chrome_devtools_mcp.sh"
STATE_DIR="${CHROME_DEVTOOLS_MCP_STATE_DIR:-/tmp/chrome-devtools-mcp-singleton}"
LOG_FILE="$STATE_DIR/server.log"

printf "%s
" "DevTools MCP singleton smoke"
printf "%s
" "State dir: $STATE_DIR"

"$MCP_SCRIPT" start -- --headless --isolated
"$MCP_SCRIPT" status

"$MCP_SCRIPT" dedupe >/dev/null 2>&1 || true

PGREP=$(pgrep -f "chrome-devtools-mcp" | tr '
' ' ' || true)
COUNT=$(pgrep -f "chrome-devtools-mcp" | wc -l | tr -d ' ' || true)

printf "%s
" "Running PIDs: ${PGREP:-none}"
printf "%s
" "Process count: ${COUNT:-0}"

if [[ -f "$LOG_FILE" ]]; then
  printf "%s
" "Log file: $LOG_FILE"
  tail -n 40 "$LOG_FILE" || true
else
  printf "%s
" "Log file not found at $LOG_FILE"
fi

cat <<'NOTE'

Manual interactive test (run from Codex CLI):
- Use the chrome-devtools MCP tools to open 2 pages, read titles, and verify both stay open.
NOTE
