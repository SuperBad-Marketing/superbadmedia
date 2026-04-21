#!/bin/sh
set -e

# Start Litestream replication in the background (SQLite → Cloudflare R2).
# If R2 credentials are missing, skip backup and run Next.js only — allows
# the container to boot in environments without backup config (e.g. preview).
if [ -n "$R2_BUCKET_NAME" ] && [ -n "$R2_ACCESS_KEY_ID" ]; then
  echo "Starting Litestream replication..."
  litestream replicate -config /etc/litestream.yml &
  LITESTREAM_PID=$!

  # Give Litestream a moment to initialise before Next.js opens the DB
  sleep 1
else
  echo "R2 credentials not set — skipping Litestream backup."
fi

echo "Starting Next.js on port ${PORT:-3001}..."
exec node server.js
