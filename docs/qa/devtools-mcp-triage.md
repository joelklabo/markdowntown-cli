# Chrome DevTools MCP Triage

## Summary
The "Transport closed" error in the Chrome DevTools MCP server typically occurs when the AI agent attempts to use the MCP tools but the underlying Chrome instance or the MCP server process itself is not responsive.

## Root Causes
1. **Port 9222 Bind Failure**: If another instance of Chrome is already running without remote debugging or on a different profile, it may block the MCP's attempt to connect to `localhost:9222`.
2. **Server Lifecycle**: The `mcp-server-chrome-devtools` may have crashed or been terminated, leaving the client with a broken pipe.
3. **Headless Mode Issues**: In some environments, headless Chrome requires specific flags (e.g., `--no-sandbox`) to initialize correctly, failing which the MCP cannot connect.

## Triage Steps
1. **Check Port 9222**:
    ```bash
    curl http://localhost:9222/json/version
    ```
    If this fails, Chrome is not running with `--remote-debugging-port=9222`.

2. **Check Process List**:
    ```bash
    ps aux | grep chrome
    ```
    Ensure Chrome is running with the expected flags.

3. **Inspect MCP Logs**:
    Check `/tmp/chrome-devtools-mcp-singleton/server.log` (if using the singleton wrapper).

## Outcome
Established that the most reliable path is to ensure a dedicated Chrome instance is launched *before* the MCP server starts. If the connection fails, the agent must fallback to manual QA as documented in `docs/qa/devtools-troubleshooting.md`.

## Known Issues
- **Concurrency**: Multiple agents trying to use the same MCP singleton may cause "Transport closed" if the server doesn't handle concurrent sessions gracefully.
- **Timeouts**: Large pages or slow networks can cause the MCP to timeout and close the transport.
