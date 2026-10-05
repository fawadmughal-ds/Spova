#!/usr/bin/env bash
cd "$(dirname "$0")/.."
pkill -f "node dist/main.js" 2>/dev/null || true
pkill -f "next start -p 3000" 2>/dev/null || true
docker compose -f infra/docker-compose.dev.yml stop
echo "stopped (db data kept; use 'docker compose -f infra/docker-compose.dev.yml down -v' to wipe)"
