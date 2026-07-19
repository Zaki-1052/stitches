# Ravelry import runbook — Cece's one-time import

*Operational companion to `docs/RAVELRY.md` §7. The script is `scripts/ravelry-import.mjs`;
it imports metadata + thumbnails only (never pattern files), is idempotent, and runs locally.
Written 2026-07-19; parks here until Cece's key arrives.*

## What it does

Cece's Ravelry **favorites → the "want to make" shelf**, **queue → "queued"**,
**library → "saved"** (a pattern on several lists takes the strongest shelf, in that order).
Her favorites' tags become Stitches tags, colors dealt round-robin through the five patches in
first-seen order. Each pattern gets the full detail mapping (weight, hook, gauge, yardage,
difficulty, notes) plus its first photo as the thumbnail. Everything lands **private**; she can
share individual patterns from the app afterwards. Re-running updates existing imports (matched
on `ravelry_id`) and never duplicates.

Not imported: her per-favorite comments (nowhere sensible to put them), projects, stash, or
anything that isn't a pattern. Books/magazines in her library that aren't tied to a single
pattern are skipped.

## Prerequisites

- The R1 migration is applied (any `npm run dev` after pulling this session's code does it).
- PocketBase is running and reachable at `PB_URL` (default local dev).

## Step 1 — Cece creates her key

1. She signs in to Ravelry and visits **ravelry.com/pro/developer** (it prompts to create a
   free Pro account on first visit — that's expected).
2. **Create new app** → type **"Basic Auth: read only or personal account access"** →
   permission level **personal account access**.
3. She sends **both halves** over a private channel (Signal/iMessage, not the group chat):
   the *access key* (username half) and the ***personal* key** (password half — not the
   "secret key" shown alongside it).

This key is full access to her account. It exists for this one job.

## Step 2 — Zara wires the env

Uncomment and fill in `.env`:

```
RAVELRY_CECE_USER=her-access-key
RAVELRY_CECE_KEY='her-personal-key'
RAVELRY_IMPORT_OWNER_EMAIL=cece@stitches.local
RAVELRY_IMPORT_OWNER_PASSWORD='changeme-cece'
```

`RAVELRY_IMPORT_OWNER_*` is the PocketBase account that will own the imported patterns —
locally the Cece seed user; against prod, her real login.

## Step 3 — Smoke test (zero writes)

```
npm run ravelry:import:smoke
```

Expected: `OK authenticated to Ravelry as "<her username>"` and an
`OK favorites/list reachable — N favorited pattern(s) total` line. A 401 here means the key
halves are swapped, mistyped, or she copied the secret key instead of the personal key.

## Step 4 — The import

```
npm run ravelry:import 2>&1 | tee logs/ravelry-import-run1.txt
```

Paced at ~1 request/second against the API; even a large library is a coffee-length run
(thumbnail downloads from the CDN are separate and quick). Every record logs `OK` (created or
updated) or `SKIP` with a reason; a pattern deleted from Ravelry since she saved it is a SKIP,
not a failure. The script stops loudly on auth or PocketBase errors.

## Step 5 — Verify

1. Run it **again**: `npm run ravelry:import 2>&1 | tee logs/ravelry-import-run2.txt` —
   the second run must report `0 created` (idempotency proof; updates are fine).
2. Cece spot-checks a handful on her phone: shelves right, tags colored, thumbnails present,
   details filled, everything private.

## Step 6 — Cece deletes the key

Once she's happy, she deletes the app at ravelry.com/pro/developer, and Zara blanks the
`RAVELRY_CECE_*` lines in `.env`. Done — the pair is never used again.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 401 from Ravelry | Key halves swapped or mistyped; or she sent the secret key, not the personal key; or the app was already deleted |
| `PB auth failed` | PocketBase not running, or `RAVELRY_IMPORT_OWNER_*` wrong |
| Many `SKIP … missing from batch response` | Patterns deleted/hidden on Ravelry since she saved them — expected, nothing to do |
| `SKIP thumbnail …` | That pattern's CDN photo failed to download; the record still imported, add a photo in-app if she cares |
| Fallback: she can't or won't make a key | Ravelry's own "export data" zip (avatar menu) has favorites/queue/library as JSON; a parser for it is deliberately not built — ask for it if this actually happens |
