#!/usr/bin/env bash
# scripts/deploy.sh — build locally, push the three artifacts, restart (SPEC §14).
# Zara runs this from the laptop; the VPS never builds anything. Idempotent — re-running
# with an unchanged tree is a harmless no-op deploy. Full walkthrough: docs/DEPLOYMENT.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS="ubuntu@146.235.203.57"

cd "$ROOT"

echo "deploy: building web"
npm run build --workspace web

echo "deploy: building importer"
npm run build --workspace importer

echo "deploy: pushing artifacts"
rsync -az --delete "$ROOT/web/dist/" "$VPS:/var/www/stitches/dist/"
rsync -az --delete "$ROOT/pb/pb_migrations/" "$VPS:/home/ubuntu/stitches/pb/pb_migrations/"
rsync -az "$ROOT/importer/dist/server.mjs" "$VPS:/home/ubuntu/stitches/importer/server.mjs"

echo "deploy: restarting services"
ssh "$VPS" 'pm2 restart stitches-pb stitches-importer'

echo "deploy: done — https://stitches.zalibhai.com"
