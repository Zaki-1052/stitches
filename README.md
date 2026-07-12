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
npm run dev
```

`npm run dev` downloads the pinned PocketBase binary (v0.39.6) on first run, applies the checked-in
migrations, and starts **PocketBase on :8090** and **Vite on :5173** together. The Vite dev server
proxies `/api` and `/_` to PocketBase, so the app is same-origin (no CORS).

## Create the superuser (once)

The superuser is the PocketBase dashboard admin — separate from the app's `users` collection, and
the only account that can create users (the invite gate). Either:

- Open the install URL printed on first `npm run dev` — `http://127.0.0.1:8090/_/` — and create it
  in the dashboard, **or**
- From the repo root (the `--dir` flag defaults to `pb/pb_data`):

  ```
  ./pb/pocketbase superuser upsert you@example.com your-strong-password
  ```

## Seed the two demo users

The seed script authenticates as the superuser and creates two demo accounts. All credentials come
from environment variables — set them, then run `npm run seed`:

```
export SUPERUSER_EMAIL=you@example.com
export SUPERUSER_PASSWORD=your-strong-password
export SEED_USER1_EMAIL=cece@stitches.local
export SEED_USER1_PASSWORD=changeme-cece
export SEED_USER1_NAME=Cece
export SEED_USER2_EMAIL=friend@stitches.local
export SEED_USER2_PASSWORD=changeme-friend
export SEED_USER2_NAME=Friend
npm run seed
```

The script is idempotent (existing users are skipped) and fails loudly if PocketBase isn't running
or a variable is missing. Log in at `/login` with a seeded user's email + password.

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
| `npm run seed` | Zara | Create the two demo users (needs the env vars above) |
| `npm run lint` | either | ESLint over `web/` |
| `npm run verify:contrast` | either | WCAG AA gate over all token pairs |
