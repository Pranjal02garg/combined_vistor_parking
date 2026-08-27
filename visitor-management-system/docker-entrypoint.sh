#!/bin/sh
set -e

echo "Starting Campus VMS Container..."

# If RUN_DB_MIGRATIONS is set to "true", run Prisma db push / migrate
if [ "$RUN_DB_MIGRATIONS" = "true" ]; then
  echo "Applying database schema changes..."
  npx prisma db push --skip-generate || echo "Warning: prisma db push encountered an issue, proceeding..."
fi

# Execute the primary container command (defaults to node server.js)
exec "$@"
