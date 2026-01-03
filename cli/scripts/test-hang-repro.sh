#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${LOG_DIR:-"$ROOT/.tmp/test-hang"}"
mkdir -p "$LOG_DIR"

STAMP=$(date +"%Y%m%d-%H%M%S")
JSON_LOG="$LOG_DIR/go-test-$STAMP.json"
TEXT_LOG="$LOG_DIR/go-test-$STAMP.log"
GO_TEST_TIMEOUT="${GO_TEST_TIMEOUT:-15m}"

cat <<EOM
Running: go test ./... -count=1 -timeout $GO_TEST_TIMEOUT -json
Logs:
- $JSON_LOG
- $TEXT_LOG
EOM

(set -o pipefail; go test ./... -count=1 -timeout "$GO_TEST_TIMEOUT" -json | tee "$JSON_LOG" > "$TEXT_LOG")

echo "Done. Tail of log:"
tail -n 20 "$TEXT_LOG"
