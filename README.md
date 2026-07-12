# Stitches

Private, invite-only crochet pattern library + craft journal for a small friend group.
Mobile-first (iPhone Safari is the runtime). Local-only through Phase 0; self-hosted on the VPS
in a later phase.

The binding docs live in [`docs/`](docs/): `SPEC.md` (architecture), `DESIGN.md` (visual system),
`PLAN.md` (build phases), `DECISIONS.md` (decisions log). Start there.

## Prerequisites

- **Node 24.18.0** (pinned; use `nvm use` — see `.nvmrc`).

## First run

```
npm install
cp .env.example .env   # then fill in the credentials — one-time setup
npm run verify:fresh
npm run dev
```

- **`.env`** (gitignored) holds every credential the scripts need: the superuser (the PocketBase
  dashboard admin — separate from the app's `users` collection, and the only account that can
  create users: the invite gate) plus the two demo accounts. All scripts load it automatically;
  variables already exported in your shell take precedence.
- **`npm run verify:fresh`** is the one-command bootstrap-and-prove run: it backs up any existing
  `pb/pb_data` (timestamped, nothing deleted), boots PocketBase alone, applies the checked-in
  migrations, upserts the superuser, seeds the demo users + starter library, and runs the access-
  matrix regression test twice (the rerun proves its cleanup is idempotent). It refuses to start
  while `npm run dev` is up. Also downloads nothing — run `npm run dev` once first if the
  PocketBase binary isn't there yet.
- **`npm run dev`** downloads the pinned PocketBase binary (v0.39.6) on first run and starts
  **PocketBase on :8090** and **Vite on :5173** together. The Vite dev server proxies `/api` and
  `/_` to PocketBase, so the app is same-origin (no CORS). Log in at `/login` with a seeded
  user's email + password.

## Seeding & rules-check individually

With `npm run dev` running in another terminal (both load `.env` on their own):

```
npm run seed           # idempotent — existing users/tags/patterns are skipped
npm run verify:rules   # the SPEC §7 access-matrix regression test (~90 checks)
```

`verify:rules` needs only the two demo-user credentials (no superuser), creates its own
`[rules-check]`-prefixed fixtures, and deletes them on the way out — it's the same script that
later runs against prod (Session 5.1, via `PB_URL=`).

## Testing on a real iPhone

The 📱 acceptance checks run on a physical device over HTTPS (needed for a secure context):

```
tailscale serve https / http://127.0.0.1:5173
```

Open the printed `*.ts.net` URL on the phone. That host suffix is already in Vite's
`server.allowedHosts`.

## Commands

| Command | Who runs it | What it does |
| --- | --- | --- |
| `npm run dev` | Zara | PocketBase :8090 + Vite :5173 (downloads PB on first run) |
| `npm run verify:fresh` | Zara | Fresh-DB bootstrap + proof: migrations → superuser → seed → rules-check ×2 |
| `npm run seed` | Zara | Demo users + starter library (idempotent; PB must be running) |
| `npm run verify:rules` | Zara | Access-matrix regression test against the running PB |
| `npm run lint` | either | ESLint over `web/` |
| `npm run verify:contrast` | either | WCAG AA gate over all token pairs |
