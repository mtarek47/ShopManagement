#!/usr/bin/env bash

# Kill any existing processes on ports 3000 & 5000
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "🚀 Starting Smart Buy POS (Backend & Frontend Desktop App)..."
npm start
