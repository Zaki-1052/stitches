#!/usr/bin/env bash
# scripts/dev.sh — one-command local dev: PocketBase (127.0.0.1:8090) + importer sidecar
# (127.0.0.1:8095) + Vite (5173).
# Downloads the pinned PocketBase binary into pb/ on first run. Zara runs this; Claude does not.

set -euo pipefail

PB_VERSION="0.39.6"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PB_DIR="$ROOT/pb"
PB_BIN="$PB_DIR/pocketbase"

platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os-$arch" in
    Darwin-arm64)  echo "darwin_arm64" ;;
    Darwin-x86_64) echo "darwin_amd64" ;;
    Linux-aarch64) echo "linux_arm64" ;;
    Linux-x86_64)  echo "linux_amd64" ;;
    *) echo "unsupported platform: $os $arch" >&2; exit 1 ;;
  esac
}

if [ ! -x "$PB_BIN" ]; then
  plat="$(platform)"
  zip="pocketbase_${PB_VERSION}_${plat}.zip"
  url="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${zip}"
  echo "Downloading PocketBase v${PB_VERSION} (${plat})…"
  curl -fL --output "$PB_DIR/$zip" "$url"
  unzip -o "$PB_DIR/$zip" pocketbase -d "$PB_DIR"
  chmod +x "$PB_BIN"
  rm "$PB_DIR/$zip"
  "$PB_BIN" --version
fi

"$PB_BIN" serve --http=127.0.0.1:8090 --dir="$PB_DIR/pb_data" --migrationsDir="$PB_DIR/pb_migrations" &
PB_PID=$!

# Importer sidecar (SPEC §10) — tsx watch in dev; the values match config.ts's defaults but
# are set explicitly to document the contract. exec keeps IMPORTER_PID = tsx itself, which
# forwards SIGTERM to its node child. .env is sourced in this subshell only (PocketBase and
# Vite don't need it): since R1 the importer requires RAVELRY_BASIC_USER/RAVELRY_BASIC at boot,
# and nothing else loads .env for a bare tsx process. PORT/PB_URL stay after the source so the
# explicit contract values keep winning.
(
  cd "$ROOT/importer"
  if [ -f "$ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  PORT=8095 PB_URL=http://127.0.0.1:8090 exec "$ROOT/node_modules/.bin/tsx" watch src/server.ts
) &
IMPORTER_PID=$!

trap 'kill "$PB_PID" "$IMPORTER_PID" 2>/dev/null || true' EXIT INT TERM

npm run dev --workspace web
