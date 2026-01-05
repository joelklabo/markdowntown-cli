# Engine WASM build

## Overview
The engine exposes a WASM entrypoint for running scan + audit in the browser. The WASM bundle is built from `cli/cmd/engine-wasm` and published into `apps/web/public/engine` for the web app to load.

## Build
Run the CLI build script from the repo root:

```bash
cli/scripts/build-wasm.sh
```

The script uses `GOOS=js` + `GOARCH=wasm` and writes:
- `apps/web/public/engine/markdowntown_engine.wasm`
- `apps/web/public/engine/wasm_exec.js`

## JS API
The WASM runtime registers `markdowntownScanAudit` on `globalThis`. The function accepts a JSON string payload and returns a JSON string response:

```json
{
  "repoRoot": "/repo",
  "files": [{"path": "README.md", "content": "# Hello"}],
  "registry": {"patterns": []},
  "includeContent": false
}
```

Responses include `ok`, `error`, and `output` fields.
