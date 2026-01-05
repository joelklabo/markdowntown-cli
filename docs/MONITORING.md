# Monitoring and Observability

## Signals
- **Tracing/Logs**: API routes use `withAPM` to attach `x-trace-id`/`x-request-id`, emit `api_request`/`api_error` structured logs, and add `Server-Timing` for total duration. Use the trace ID to correlate console logs, frontend calls, and Azure Monitor queries.
- **Health**: `GET /api/health` returns queue/worker status based on environment configuration and is wrapped with APM headers.
- **Metrics**: Container Apps logs and metrics flow into Log Analytics; Application Insights (created via `monitoring.bicep`) links to the shared workspace for dashboards/alerts.

## Azure Monitor wiring
- Resources: `infra/main.bicep` provisions Log Analytics and the `monitoring.bicep` module (Application Insights) and injects `APPLICATIONINSIGHTS_CONNECTION_STRING` into the app/worker.
- Add dashboards/alerts in Azure Monitor targeting the Log Analytics workspace and App Insights component (recommend alerts on failed ContainerAppJobRuns, request error rate, and health endpoint availability).

## Health checks
- Endpoint: `GET /api/health`
- Response shape:
  ```json
  {
    "status": "ok | degraded",
    "services": {
      "queue": "ok | missing",
      "worker": "ok | missing"
    },
    "timestamp": "ISO-8601"
  }
  ```
- Headers: `x-trace-id`, `x-request-id`, and `Server-Timing` are set for correlation.

## Querying logs
- In Log Analytics (workspace `${namePrefix}-${environment}-logs-*`):
  - API requests: `ContainerAppConsoleLogs_CL | where Log_s == "api_request" | project TimeGenerated, traceId=traceId_s, path=path_s, status=status_d, durationMs=durationMs_d`
  - API errors: `ContainerAppConsoleLogs_CL | where Log_s == "api_error"`
- Use the trace ID from `Server-Timing`/`x-trace-id` to join across logs.

## Local/dev notes
- Health checks read `WEBPUBSUB_CONNECTION_STRING` and `WORKER_IMAGE`; unset values report `degraded` for clarity in dev.
- If Application Insights is not provisioned, `APPLICATIONINSIGHTS_CONNECTION_STRING` may be empty; APM headers/logs still emit locally.
