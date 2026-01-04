# go test hang investigation

## Summary
Local runs of `make test` / `go test ./...` sometimes appeared to hang. The most common failure observed was disk space exhaustion in the Go build temp/cache directories, which made tests stall and eventually fail. Clearing Go caches and ensuring free space restored normal runs.

## Repro script
Use the repro script to capture JSON logs for the last package/test executed:

```
./scripts/test-hang-repro.sh
```

Outputs are written to `.tmp/test-hang/` and include both JSON and text logs.

## Root cause (current)
- **Disk space exhaustion** in `/var/folders/...` (Go build temp) produced slow/stalled test runs and failures.
- Mitigation: `go clean -cache -testcache` and ensure free space before rerunning tests.

## Mitigations added
- HTTP fetcher tests now enforce client timeouts to avoid indefinite waits.
- Git and Go build helpers in integration tests use context timeouts to prevent hangs.

## If the hang persists
1. Run the repro script and note the last package in the log.
2. Check free space (`df -h`) and clear Go caches if needed.
3. Re-run with a shorter timeout:
   - `GO_TEST_TIMEOUT=5m ./scripts/test-hang-repro.sh`
4. Open an issue with the log file path and last package output.
