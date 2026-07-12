#!/usr/bin/env bash
# scripts/verify-fresh.sh — one-command fresh-database acceptance run (PLAN Session 1.1):
# back up pb_data → boot PocketBase alone (migrations auto-apply) → superuser upsert → seed →
# rules-check twice (the second run proves the sweep is idempotent). Vite is not started.
# Zara runs this: npm run verify:fresh. Credentials come from .env (copy .env.example).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PB_BIN="$ROOT/pb/pocketbase"
PB_URL="${PB_URL:-http://127.0.0.1:8090}"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$ROOT/.env"
  set +a
fi

for var in SUPERUSER_EMAIL SUPERUSER_PASSWORD \
           SEED_USER1_EMAIL SEED_USER1_PASSWORD SEED_USER1_NAME \
           SEED_USER2_EMAIL SEED_USER2_PASSWORD SEED_USER2_NAME; do
  if [ -z "${!var:-}" ]; then
    echo "verify-fresh: $var is not set — copy .env.example to .env and fill it in" >&2
    exit 1
  fi
done

if [ ! -x "$PB_BIN" ]; then
  echo "verify-fresh: $PB_BIN not found — run 'npm run dev' once to download it, then re-run" >&2
  exit 1
fi

if curl -sf "$PB_URL/api/health" >/dev/null 2>&1; then
  echo "verify-fresh: something is already serving $PB_URL — stop 'npm run dev' first" >&2
  exit 1
fi

if [ -d "$ROOT/pb/pb_data" ]; then
  backup="$ROOT/pb/pb_data.bak-$(date +%Y%m%d-%H%M%S)"
  mv "$ROOT/pb/pb_data" "$backup"
  echo "verify-fresh: existing pb_data backed up to $backup"
fi

"$PB_BIN" serve --http=127.0.0.1:8090 --dir="$ROOT/pb/pb_data" --migrationsDir="$ROOT/pb/pb_migrations" &
PB_PID=$!
trap 'kill "$PB_PID" 2>/dev/null || true' EXIT INT TERM

echo "verify-fresh: waiting for PocketBase to come up (migrations apply now)…"
healthy=""
for _ in $(seq 1 60); do
  if curl -sf "$PB_URL/api/health" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  if ! kill -0 "$PB_PID" 2>/dev/null; then
    echo "verify-fresh: PocketBase exited during startup — a migration failed; see output above" >&2
    exit 1
  fi
  sleep 0.5
done
if [ -z "$healthy" ]; then
  echo "verify-fresh: PocketBase never became healthy at $PB_URL" >&2
  exit 1
fi

echo
echo "verify-fresh: superuser upsert"
"$PB_BIN" superuser upsert "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" --dir "$ROOT/pb/pb_data"

echo
echo "verify-fresh: seed (users + starter library)"
node "$ROOT/scripts/seed.mjs"

echo
echo "verify-fresh: rules-check — run 1"
node "$ROOT/scripts/rules-check.mjs"

echo
echo "verify-fresh: rules-check — run 2 (sweep idempotency)"
node "$ROOT/scripts/rules-check.mjs"

echo
echo "verify-fresh: ALL GREEN — fresh migrations, seed, and rules-check ×2."
echo "verify-fresh: next → npm run dev, then log in as $SEED_USER1_EMAIL"
