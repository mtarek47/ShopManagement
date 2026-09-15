#!/usr/bin/env bash
set -e

echo "===================================================================="
echo "          Smart Buy POS — Web Application Launcher"
echo "===================================================================="
echo

if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Error: Docker is not installed or not in PATH."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker daemon is not running. Please start Docker Desktop first."
    exit 1
fi

echo "🚀 Building and starting Smart Buy POS containers..."
docker compose --env-file .env.docker up -d --build

echo
echo "===================================================================="
echo "  Smart Buy POS is running at: http://localhost:3000"
echo "  - Admin Login:        01700000000 / admin123"
echo "  - Master Super Admin: 01999999999 / superadmin123"
echo "===================================================================="
echo

# Try opening in browser on macOS / Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    sleep 3
    open http://localhost:3000 || true
elif command -v xdg-open >/dev/null 2>&1; then
    sleep 3
    xdg-open http://localhost:3000 || true
fi
