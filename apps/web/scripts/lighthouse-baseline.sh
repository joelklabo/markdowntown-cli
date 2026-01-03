#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${E2E_BASE_URL:-"https://markdown.town"}
OUTDIR=${1:-".lighthouse-baseline"}
PAGES=("/" "/browse" "/builder")
mkdir -p "$OUTDIR"

for page in "${PAGES[@]}"; do
  slug=$(echo "$page" | sed 's|/||g; s|^$|home|')
  npx lighthouse "${BASE_URL}${page}" \
    --preset=desktop \
    --output=json \
    --output-path="$OUTDIR/lh-${slug}-desktop.json" \
    --chrome-flags="--headless=new" \
    --throttling.cpuSlowdownMultiplier=1 \
    --quiet
  npx lighthouse "${BASE_URL}${page}" \
    --preset=mobile \
    --output=json \
    --output-path="$OUTDIR/lh-${slug}-mobile.json" \
    --chrome-flags="--headless=new" \
    --throttling.cpuSlowdownMultiplier=1 \
    --quiet
  echo "Captured $page"
done

node - <<'NODE'
const fs = require('fs');
const path = require('path');
const outdir = process.argv[2];
const files = fs.readdirSync(outdir).filter(f => f.endsWith('.json'));
const metrics = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(outdir, file), 'utf8'));
  metrics.push({
    file,
    url: data.requestedUrl,
    lcp: data.audits['largest-contentful-paint']?.numericValue,
    tti: data.audits['interactive']?.numericValue,
    ttfb: data.audits['server-response-time']?.numericValue,
    cls: data.audits['cumulative-layout-shift']?.numericValue,
    score: data.categories.performance.score,
  });
}
console.table(metrics);
NODE "$OUTDIR"
