#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
OUT_DIR="${OUT_DIR:-"$REPO_ROOT/apps/web/public/engine"}"
WASM_NAME="${WASM_NAME:-markdowntown_engine.wasm}"

cd "$ROOT"

mkdir -p "$OUT_DIR"

# Build with size optimization flags (-s removes symbol table, -w removes DWARF debug info)
GOOS=js GOARCH=wasm CGO_ENABLED=0 go build \
  -trimpath \
  -buildvcs=false \
  -ldflags="-s -w" \
  -o "$OUT_DIR/$WASM_NAME" \
  ./cmd/engine-wasm

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
size_mb=$(awk "BEGIN {printf \"%.2f\", $size_bytes / 1024 / 1024}")

printf "Built %s (%s KB, %s MB)\n" "$OUT_DIR/$WASM_NAME" "$size_kb" "$size_mb"

# Add Brotli compression
if command -v brotli >/dev/null 2>&1; then
  brotli -f -9 "$OUT_DIR/$WASM_NAME"
  br_size_bytes=$(wc -c < "$OUT_DIR/$WASM_NAME.br" | tr -d ' ')
  br_size_kb=$((br_size_bytes / 1024))
  printf "Compressed to %s.br (%s KB)\n" "$OUT_DIR/$WASM_NAME" "$br_size_kb"
else
  echo "WARNING: brotli not found, skipping compression"
fi

# Warn if size exceeds budget
SIZE_BUDGET_KB=7168  # 7 MB warning threshold
SIZE_LIMIT_KB=15360  # 15 MB hard limit
if [ "$size_kb" -gt "$SIZE_LIMIT_KB" ]; then
  echo "ERROR: WASM size ($size_kb KB) exceeds hard limit ($SIZE_LIMIT_KB KB)" >&2
  exit 1
elif [ "$size_kb" -gt "$SIZE_BUDGET_KB" ]; then
  echo "WARNING: WASM size ($size_kb KB) exceeds budget ($SIZE_BUDGET_KB KB)" >&2
fi

