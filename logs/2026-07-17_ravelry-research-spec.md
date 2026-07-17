# 2026-07-17 — Ravelry API research + integration spec

Research-only session (no implementation). Four parallel Opus research agents + Zara's
logged-in captures produced an approved spec and working plan for the Ravelry feature
(SPEC §17 backlog, Cece's request).

## What was done

- Four research tracks: OAuth 2.0 mechanics · endpoint surface/field mapping · library-import
  feasibility · API license agreement. All four returned; findings cross-checked against the
  official docs dump Zara captured.
- Zara created two Ravelry credentials mid-session: `ravelry-basic` (read-only basic auth;
  password in `.env` as `RAVELRY_BASIC`) and the pre-existing `ravelry-stitches` OAuth app
  (parked — core needs no OAuth, no redirect URIs).
- Live smoke tests (Zara-run): key works (HTTP 200 on `patterns/{id}.json`), ETags confirmed
  (`W/"…"`), `craft=crochet` search filter confirmed, `medium2_url` present.
- Spec written and approved: `docs/RAVELRY.md` — core (importer-side link enrichment +
  in-app search on the basic key), gated stretch (one-time metadata import script), sketch
  (purchased-PDF vault import, not planned).
- Plan written: root `PLAN.md` (R1 enrichment / R2 search door / R3 gated import).

## Decisions made

- Core auth = read-only basic key server-side in the importer; enrichment as an
  `/import/extract` branch with soft fall-through to the OG scrape; importer normalizes to
  Stitches vocabulary; `patterns` gains `ravelry_id` + `ravelry_fetched_at` by migration.
- Import stretch = local script (favorites → want_to_make, queue → queued, library → saved;
  tags round-robin), GDPR-export parser as fallback; gated on Cece's saved-count.
- License posture: metadata-only ingestion; thumbnail re-hosting kept (agreement has no
  hotlink rule; storage clause covers it); disclosure line + provenance fields required.
- DECISIONS.md gained one line; `.env.example` gained the `RAVELRY_BASIC*` block (plus a stale
  `--env-file-if-missing` comment fixed to `--env-file-if-exists`).

## Open items

- Spec §9 #1: `pattern_needle_sizes` discriminator — one live fetch of a crochet pattern
  (command handed to Zara), then amend RAVELRY.md §4.2.
- Spec §9 #5 (R3 gate): cross-user favorites read with a personal-access key.
- R2 door placement (4th door vs inside Paste-a-link) — decide with Zara in-session.
- Ask Cece how much she has saved on Ravelry (gates R3 entirely).
- Commits for this session's files are Zara's.

## Key file paths

- `docs/RAVELRY.md` (spec) · `PLAN.md` (working plan) · `docs/DECISIONS.md` (+1 line)
- `docs/ravelry-docs.md` (API docs dump) · `docs/research/ravelry-api-agreement.md` (license)
- `.env.example` (Ravelry env block) · `scripts/.cache/ravelry-smoke.json` / `ravelry-search.json`
