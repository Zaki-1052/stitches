# pb/pb_migrations

PocketBase JS migration files live here — the **only** way schema changes (SPEC §16 #2).

Empty until Session 1.1 (first migration: the `users` auth collection config arrives in
Session 0.2). `scripts/dev.sh` points PocketBase at this directory via `--migrationsDir`,
and migrations auto-apply on `serve` (automigrate is on by default in the prebuilt binary).

The PocketBase binary (`pb/pocketbase`) and its data directory (`pb/pb_data/`) are
gitignored; `scripts/dev.sh` downloads the pinned binary on first run.
