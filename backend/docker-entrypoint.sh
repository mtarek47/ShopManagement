#!/bin/sh
set -e

echo "==================================================="
echo "  Starting Smart Buy POS Backend Service"
echo "==================================================="

# Extract host and user from environment or defaults
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-pos_user}

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "PostgreSQL is not ready yet - sleeping 1s..."
  sleep 1
done
echo "✅ PostgreSQL is ready and accepting connections!"

# Synchronize Prisma schema
echo "📦 Synchronizing Prisma database schema..."
cd /app/database
npx prisma db push --schema=schema.prisma --accept-data-loss

echo "⚙️ Syncing Prisma Client to backend..."
mkdir -p /app/backend/node_modules/.prisma
cp -r /app/database/node_modules/.prisma /app/backend/node_modules/ 2>/dev/null || true
cp -r /app/database/node_modules/@prisma /app/backend/node_modules/ 2>/dev/null || true

# Run database seeder (upserts admin & default products idempotently)
echo "🌱 Running database seeder..."
cd /app/database
node seeders/seed.js || echo "⚠️ Seeder completed with warnings."

# Return to backend directory and start server
cd /app/backend
echo "🚀 Starting Node.js backend..."
exec "$@"
