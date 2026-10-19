#!/usr/bin/env bash
# Start the whole stack locally in production mode (what we show in the demo).
#   ./scripts/up.sh          build + start
#   ./scripts/up.sh --dev    hot-reload dev servers instead (turbo dev)
#   ./scripts/down.sh        stop everything
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.npm-global/bin:$PATH"

[ -f .env ] || { cp .env.example .env; echo "created .env from .env.example"; }
[ -e apps/api/.env ] || ln -s ../../.env apps/api/.env

echo "== db (postgres + redis)"
docker compose -f infra/docker-compose.dev.yml up -d
for i in $(seq 1 30); do
  pg_ok=$(docker inspect -f '{{.State.Health.Status}}' spova-dev-postgres-1 2>/dev/null || echo starting)
  [ "$pg_ok" = healthy ] && break; sleep 1
done

echo "== shared + migrations + seed"
pnpm --filter @spova/shared build >/dev/null
pnpm --filter @spova/api exec prisma migrate deploy >/dev/null
pnpm --filter @spova/api exec prisma generate >/dev/null
pnpm --filter @spova/worker prisma:generate >/dev/null
pnpm --filter @spova/api prisma:seed

if [ "${1:-}" = "--dev" ]; then
  exec pnpm dev
fi

echo "== build"
pnpm --filter @spova/api build >/dev/null
pnpm --filter @spova/web build >/dev/null
pnpm --filter @spova/worker build >/dev/null

echo "== start"
pkill -f "node apps/api/dist/main.js" 2>/dev/null || true
pkill -f "node apps/worker/dist/main.js" 2>/dev/null || true
pkill -f "next start -p 3000" 2>/dev/null || true
mkdir -p .logs
# setsid + full fd redirection so the servers fully detach from this script (and any pipe it is in)
setsid nohup node apps/api/dist/main.js > .logs/api.log 2>&1 < /dev/null &
setsid nohup pnpm --filter @spova/web exec next start -p 3000 > .logs/web.log 2>&1 < /dev/null &
setsid nohup node apps/worker/dist/main.js > .logs/worker.log 2>&1 < /dev/null &
sleep 6
curl -fsS localhost:4000/health/ready && echo
echo
echo "web    http://localhost:3000"
echo "api    http://localhost:4000/health/ready"
echo "admin  admin@zerventa.local / Admin@12345   -> http://localhost:3000/admin"
echo "client client@zerventa.local / Client@12345 -> http://localhost:3000/app"
echo "trade  http://localhost:3000/trade   (worker streams Binance crypto + synthetic FX; log in .logs/worker.log)"
echo "logs   tail -f .logs/api.log .logs/web.log .logs/worker.log   (password-reset emails print in api.log)"
