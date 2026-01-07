#!/usr/bin/env sh
set -e

APP_DIR="${APP_DIR:-/app/apps/web}"

if [ "${SKIP_DB:-0}" = "1" ]; then
  echo "SKIP_DB=1 set; skipping prisma migrations"
else
  echo "Running prisma migrate deploy..."
  cd "$APP_DIR"
  retries=5
  until prisma migrate deploy; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      echo "Migrations failed, exiting"
      exit 1
    fi
    echo "Migrate failed, retrying in 3s... ($retries retries left)"
    sleep 3
  done
  cd /app
fi

echo "Starting app..."
exec node apps/web/server.js
