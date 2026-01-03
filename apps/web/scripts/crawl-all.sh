#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:3000}
OUT=${1:-/tmp/crawl.json}
CRAWL_WAIT_MS=${CRAWL_WAIT_MS:-300}
CRAWL_MAX=${CRAWL_MAX:-120}
CRAWL_TIMEOUT=${CRAWL_TIMEOUT:-4000}

node scripts/crawl-all.js > "$OUT"
echo "Crawl complete -> $OUT"
