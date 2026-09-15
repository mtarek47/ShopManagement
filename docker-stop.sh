#!/usr/bin/env bash
set -e

echo "🛑 Stopping Smart Buy POS containers..."
docker compose down
echo "✅ All containers stopped safely. Database volume preserved."
