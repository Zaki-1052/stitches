# 2026-07-21 — Deployment guide (docs/DEPLOYMENT.md) + deploy.sh

## What was done

- Wrote `docs/DEPLOYMENT.md`: the full zero-to-live walkthrough for
  `stitches.zalibhai.com` on the Oracle Cloud Arm64 VPS (Ubuntu 22.04,
  `ubuntu@146.235.203.57`, baked in per Zara). Covers grey-cloud DNS, the OCI
  double-firewall (security list + Oracle's default iptables REJECT), Node 24 via
  NodeSource, PM2 (ecosystem file with the Ravelry env, `interpreter: 'none'` for the PB
  binary, startup/save), the PB v0.39.6 linux_arm64 binary, superuser upsert, two-stage
  Nginx + certbot webroot TLS, htpasswd for `/_/`, prod rules-check via two throwaway
  dashboard accounts, real-account creation, R2 backups from scratch (bucket, S3 token,
  PB Backups panel, restore test), repeat deploys, and troubleshooting.
- Created `scripts/deploy.sh` (SPEC §14: build web + importer → rsync three artifacts →
  `pm2 restart` over SSH). Zara still needs to `chmod +x` it.

## Decisions made (proposals — nothing run against the VPS yet)

- **Repo never lands on the VPS** — restated SPEC §14's artifact-only design over Zara's
  "clone or rsync the folder" assumption; only `web/dist/`, `pb_migrations/`, and
  `importer/dist/server.mjs` are pushed.
- **Node 24 via NodeSource system install, not nvm** — PM2's systemd resurrection and
  deploy.sh's non-interactive `ssh … pm2 restart` both miss nvm-managed PATHs.
- **Nginx config written in 1.18 syntax** (`listen 443 ssl http2;`) since Ubuntu 22.04
  apt ships 1.18 and SPEC §13's `http2 on;` needs ≥1.25.1; doc says to add a DECISIONS
  line for whichever form prod ends up using.
- **Layout:** `~/stitches/{pb,importer}` + ecosystem file; web build at
  `/var/www/stitches/dist` chowned to `ubuntu` so deploys never sudo.
- **No `npm run seed` against prod** (starter library would pollute the friends feed);
  prod rules-check instead uses two dashboard-created throwaway accounts, deleted after.
- Ravelry secrets carried in the PM2 ecosystem env (`chmod 600`), copied from local `.env`.
- Noted in-doc: the public repo now contains the VPS IP/user — public via DNS anyway once
  the grey-cloud record exists; SSH is key-only. Zara can strip it pre-commit if unwanted.

## Open items

- Session 5.1 itself (actually running the provisioning) — this was docs only.
- `chmod +x scripts/deploy.sh` (Zara).
- PB v0.39.6 Backups-panel field names described from SPEC §14 + R2 conventions
  (region `auto`, force path-style ON) — sanity-check against the live panel during 5.1.
- DECISIONS line for the nginx syntax form, once prod's nginx version is known.
- Session 6.4 will later require: `--hooksDir` in the ecosystem args, `pb_hooks` rsync in
  deploy.sh, and an Nginx `/share/` location (flagged in DEPLOYMENT.md Part 15).

## Key file paths

- `docs/DEPLOYMENT.md` (new)
- `scripts/deploy.sh` (new)
