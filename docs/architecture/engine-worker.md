# Engine Worker Service

## Purpose

Provide a native Go worker that evaluates audit/suggest runs without the WASM layer. This service is intended for:

- Azure Container Apps jobs or sidecars.
- Internal API callers that need deterministic Go rule execution.

The worker uses the shared `cli/internal/engine` runner and the CLI rule packages (`internal/audit`, `internal/suggest`).

## HTTP API

### `POST /run`

Run a request. The worker responds with a structured JSON envelope.

Request body:

```json
{
  "id": "run-123",
  "type": "audit",
  "timeoutMs": 30000,
  "audit": {
    "scan": { "schemaVersion": "scan-spec-v1", "repoRoot": "/repo", "configs": [], "warnings": [] },
    "redactMode": "auto",
    "includeScanWarnings": true,
    "onlyRules": ["MD001"],
    "ignoreRules": ["MD011"],
    "excludePaths": ["**/vendor/**"],
    "severityOverrides": { "MD002": "error" },
    "homeDir": "/home/user",
    "xdgConfigHome": "/home/user/.config"
  }
}
```

```json
{
  "id": "run-456",
  "type": "suggest",
  "timeoutMs": 30000,
  "suggest": {
    "client": "codex",
    "refresh": false,
    "offline": false,
    "explain": true
  }
}
```

Response body:

```json
{
  "id": "run-123",
  "type": "audit",
  "ok": true,
  "durationMs": 42,
  "audit": {
    "output": { "schemaVersion": "audit-spec-v1", "issues": [] }
  }
}
```

Errors:

```json
{
  "id": "run-123",
  "ok": false,
  "error": {
    "code": "invalid_request",
    "message": "scan repoRoot is required"
  }
}
```

### `GET /health`

Returns `{ "ok": true }` when the service is running.

## Configuration

Environment variables:

- `ENGINE_WORKER_ADDR` (default `:8080`)
- `PORT` (fallback for managed environments)
- `ENGINE_WORKER_TIMEOUT_MS` (default `30000`)
- `ENGINE_WORKER_MAX_BODY_MB` (default `8`)
- `MARKDOWNTOWN_REGISTRY` (path to `ai-config-patterns.json`)
- `MARKDOWNTOWN_SOURCES` (path to `doc-sources.json`)

## Timeouts

Requests are wrapped in a context timeout. For audit runs, timeouts are checked between rule evaluations; the worker returns a structured timeout error. Suggest runs pass the context into fetchers so outbound requests respect the deadline.

## Docker

Build the worker image:

```bash
docker build -f Dockerfile.worker .
```

The image includes `ai-config-patterns.json` and `doc-sources.json` and sets the required env vars for registry discovery.
