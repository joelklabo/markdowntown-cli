#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-"$ROOT/dist/wasm"}"
WASM_NAME="${WASM_NAME:-markdowntown_scan_audit.wasm}"

cd "$ROOT"

mkdir -p "$OUT_DIR"

GOOS=js GOARCH=wasm CGO_ENABLED=0 go build -o "$OUT_DIR/$WASM_NAME" ./internal/wasm

GOROOT="$(go env GOROOT)"
WASM_EXEC_PATH="$GOROOT/lib/wasm/wasm_exec.js"
if [ ! -f "$WASM_EXEC_PATH" ]; then
  WASM_EXEC_PATH="$GOROOT/misc/wasm/wasm_exec.js"
fi
if [ ! -f "$WASM_EXEC_PATH" ]; then
  echo "wasm_exec.js not found under $GOROOT" >&2
  exit 1
fi
cp "$WASM_EXEC_PATH" "$OUT_DIR/wasm_exec.js"

size_bytes=$(wc -c < "$OUT_DIR/$WASM_NAME" | tr -d ' ')
size_kb=$((size_bytes / 1024))

printf "Built %s (%s KB)\n" "$OUT_DIR/$WASM_NAME" "$size_kb"
