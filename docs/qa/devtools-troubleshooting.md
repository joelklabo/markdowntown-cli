# DevTools MCP Troubleshooting

The Chrome DevTools MCP server allows AI agents to inspect the console and network activity of the running web app. This is critical for verifying telemetry and API interactions without manual intervention.

## Common Errors

### "Transport closed"
**Symptoms:**
- `mcp__chrome-devtools__list_pages` fails with "Transport closed" or similar connection errors.
- The agent cannot see any open pages.

**Causes:**
- Chrome is not running with remote debugging enabled (`--remote-debugging-port=9222`).
- The MCP server process died or was killed.
- Chrome crashed or was closed.

## Fallback (Manual QA)
If the DevTools MCP is unavailable, you must perform manual verification:

1. **Open the App**: Navigate to [http://localhost:3000](http://localhost:3000).
2. **Open DevTools**: Press `F12` or `Cmd+Option+I`.
3. **Verify Console**:
   - Check for errors (red) or warnings (yellow).
   - Filter for specific logs (e.g., `[telemetry]`, `[api]`).
4. **Verify Network**:
   - Check for failed requests (4xx/5xx).
   - Inspect payloads for key events (e.g., `/api/cli/upload`).

## Recovery Steps

1. **Restart Chrome**:
   ```bash
   # MacOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```

2. **Restart the MCP Server**:
   - If running via a tool wrapper, restart the agent or environment.
   - If running standalone, restart the `mcp-server-chrome-devtools` process.

3. **Check Port 9222**:
   - Ensure `localhost:9222/json/version` returns JSON.
