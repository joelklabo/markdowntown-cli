# DevTools MCP QA Workflow

This document describes how to use the Chrome DevTools MCP for QA and provides a fallback when the transport fails.

## Usage

1. **Start the MCP server**:
   ```bash
   pnpm -C apps/web mcp:devtools
   ```

2. **Validate connection**:
   Use `mcp__chrome-devtools__list_pages` to verify the server can see your open Chrome tabs.

3. **Record Evidence**:
   Capture console logs and network requests using the provided tools.

## Troubleshooting "Transport closed"

If you encounter "Transport closed" errors:

- **Check Chrome instance**: Ensure Chrome is running with remote debugging enabled (`--remote-debugging-port=9222`).
- **Port Conflict**: Verify no other process is using port 9222.
- **Restart MCP**: Stop and start the MCP server.

## Playwright Fallback

When DevTools MCP is unavailable, use Playwright to capture evidence:

1. **Console Logs**:
   ```javascript
   page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
   ```

2. **Network Requests**:
   ```javascript
   page.on('requestfailed', request => {
     console.log(`REQUEST FAILED: ${request.url()} ${request.failure().errorText}`);
   });
   ```

3. **Manual Verification**:
   Run the Playwright smoke script:
   ```bash
   node scripts/qa/playwright-smoke.js
   ```
