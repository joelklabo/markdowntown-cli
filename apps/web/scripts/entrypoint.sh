#!/usr/bin/env sh
set -e

if [ "${SKIP_DB:-0}" = "1" ]; then
  echo "SKIP_DB=1 set; skipping prisma migrations"
else
  echo "Running prisma migrate deploy..."
  retries=5
  until pnpm prisma migrate deploy; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      echo "Migrations failed, exiting"
      exit 1
    fi
    echo "Migrate failed, retrying in 3s... ($retries retries left)"
    sleep 3
  done
fi

echo "Starting app..."
exec pnpm start
