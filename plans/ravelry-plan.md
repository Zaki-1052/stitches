# Ravelry Integration — Plan

*Working plan for the `docs/RAVELRY.md` spec (approved 2026-07-17). Per-session sidecar briefs
land in `plans/` at the start of each session, per convention. Companion research:
`docs/ravelry-docs.md`, `docs/research/ravelry-api-agreement.md`.*

## Context

Cece asked for the Ravelry feature (SPEC §17 backlog, pulled forward). Research session
2026-07-17 settled the facts: the read-only basic key (`ravelry-basic`, already in `.env`)
covers enrichment and search entirely server-side; the OAuth app stays parked. Spec:
`docs/RAVELRY.md`. Outcome: paste a Ravelry link → fully pre-filled form; search Ravelry from
the quick-add flow; optionally (gated) a one-time import of Cece's saved patterns.

## Decisions

- Core auth = read-only basic key in the importer; OAuth app untouched until R3+ · simplest
  thing that works, verified live 2026-07-17.
- Enrichment is a branch inside `/import/extract` with fall-through to the OG scrape on any
  Ravelry failure · soft failure is the importer's existing contract.
- Importer normalizes to Stitches vocabulary (CYC, mm, difficulty buckets) server-side · one
  mapping, testable in the verify script; client stays dumb.
- Search = `POST /import/ravelry/search`, fixed `page_size=20`, `craft=crochet` · verified live.
- `patterns` gains `ravelry_id` + `ravelry_fetched_at` by migration · provenance/idempotency
  (RAVELRY.md §6).
- R3 import = local script; auth = Cece's *own* personal-access basic key in `.env`
  (`RAVELRY_CECE_USER`/`RAVELRY_CECE_KEY`, script-only), GDPR-export parser as fallback · gate
  resolved 2026-07-18 (Cece wants the import); her own key authenticates as her, so the §9 #5
  cross-user check is moot and OAuth stays parked for good.
- PDF vault import is sketched in the spec, **not** in this plan · revisit only on Cece's ask.
- Once R1 lands, the importer requires `RAVELRY_BASIC_USER`/`RAVELRY_BASIC` at boot (fail fast,
  no half-configured state).
- Search-door placement (4th door vs inside Paste-a-link screen) decided in R2 with Zara +
  DECISIONS line · deviates from DESIGN §9's three-door list either way.

## Files

| Path | Change | Why |
|---|---|---|
| `importer/src/ravelry/detect.ts` | create | URL → permalink matcher (RAVELRY.md §4.1); pure, unit-testable |
| `importer/src/ravelry/client.ts` | create | Basic-auth GET + in-memory ETag/If-None-Match cache (LRU-capped) + UA; reuses undici Agent conventions from `net/guardedFetch.ts` |
| `importer/src/ravelry/map.ts` | create | `Pattern (full)` → extended contract (CYC table, hook pick, difficulty buckets, trim-everything) |
| `importer/src/routes/extract.ts` | modify | Ravelry branch after `parseTargetUrl`, fall-through to existing OGS path |
| `importer/src/routes/ravelrySearch.ts` | create | `POST /import/ravelry/search`; same shape as existing routes |
| `importer/src/app.ts` | modify | register search route — reuses existing auth hook + per-user rate limit untouched |
| `importer/src/config.ts` | modify | `RAVELRY_BASIC_USER` / `RAVELRY_BASIC` (required once present) |
| `pb/pb_migrations/*_patterns_ravelry.js` | create | optional `ravelry_id` (number) + `ravelry_fetched_at` (date); rules unchanged |
| `web/src/features/patterns/importerClient.ts` | modify | extended `ExtractedMetadata` type (`ravelry?` block) |
| `web/src/features/patterns/usePasteLinkDoor.ts` / `pendingUrlImport.ts` | modify | carry the `ravelry` block to the form |
| `web/src/features/patterns/PatternForm*` | modify | prefill Details/craft/notes from `ravelry` block; sets `ravelry_id`/`ravelry_fetched_at` |
| `web/src/features/patterns/` search door (R2) | create | search screen + result cards; reuses Avatar/chip/card primitives + `usePasteLinkDoor`'s save-form handoff |
| `scripts/verify/importer-check.mjs` | modify | `[net]` Ravelry cases: enrichment happy path, 404 fall-through, search shape |
| `scripts/ravelry-import.mjs` (R3, gated) | create | one-time import per RAVELRY.md §7; follows `seed.mjs` conventions |

## Steps

### Phase R1 — Importer enrichment
- [x] Close spec §9 #1 (needle-size discriminator) with one live fetch of a crochet pattern;
      amend RAVELRY.md §4.2 to match reality *(done pre-R1, 2026-07-17: Zara's live call showed
      `crochet: true` + `metric`; spec updated)*
- [x] `detect.ts` + `client.ts` + `map.ts` (mapping tables verbatim from RAVELRY.md §4.2)
- [x] Extract-branch wiring with logged fall-through; extended contract out
- [x] Migration: `ravelry_id` + `ravelry_fetched_at`
- [x] Form prefill + both fields saved on create
- [x] `importer-check.mjs` gains Ravelry cases; lint clean *(Zara confirmed 2026-07-19:
      verify:importer 34/34, verify:fresh ALL GREEN, manual paste checked)*

### Phase R2 — Search door
- [x] `POST /import/ravelry/search` + client wrapper
- [x] Door-placement decision with Zara → DECISIONS line *(4th door everywhere, coral, 2×2)*
- [x] Search screen: box → cards (square thumb, name, designer, free badge) → tap → prefilled
      save form via the R1 path; CDN-direct result thumbnails, nothing stored
- [x] Disclosure microcopy (on-voice, no em-dashes) on the search surface
- [x] 📱 device pass *(Zara confirmed 2026-07-19; follow-ups from testing: RATE_LIMIT_MAX
      20→40, rate-limited imports now explain in place instead of opening a blank form)*

### Phase R3 — One-time import (gate resolved 2026-07-18: Cece wants it; builds after R1)
- [ ] Cece creates a personal-access key at ravelry.com/pro/developer and sends both halves
      privately (the *personal* key, not the secret key); Zara adds
      `RAVELRY_CECE_USER`/`RAVELRY_CECE_KEY` to `.env` — can happen any time, parks until R3
- [ ] Smoke-test her key (`current_user.json`, then a one-page `favorites/list`) before the
      full run
- [ ] `scripts/ravelry-import.mjs`: favorites/queue/library → dedupe → batch details →
      patterns + tags + thumbnails, idempotent on `ravelry_id`, ~1 req/s *(script + runbook
      written 2026-07-19 — `docs/ravelry-import-runbook.md`; box ticks after the real run)*
- [ ] Cece deletes the app/key on Ravelry once the import is verified on her phone

## Edge cases

- Ravelry 404/429/timeout/network → logged fall-through to OG scrape; UX identical to today.
- Absent fields (`yarn_weight` `{}`/null, no crochet hook, `difficulty_count: 0`, no photos) →
  field stays unset; a photo-less pattern just opens the form without a thumbnail.
- Unknown yarn-weight names / non-CYC values → unset, never guessed.
- Multiple crochet hooks → smallest mm (spec §4.2).
- Tunisian: attribute/category permalink containing `tunisian` → `tunisian`, else `crochet`.
- Trailing whitespace in Ravelry strings (seen live) → mapper trims all strings.
- Weak ETags (`W/"…"`) sent back verbatim; ETag cache LRU-capped so the sidecar can't grow
  unbounded.
- Non-library Ravelry URLs (projects, stores, `rav.me`) → not matched, plain OG path.
- Missing `RAVELRY_BASIC*` env after R1 → importer fails at boot with a clear message.
- Search with zero results → paginator honest, UI empty state (R2 microcopy).

## Verification

Zara runs every item; boxes tick only on her confirmation (phase-boundary testing).

1. **R1 unit/lint:** `npm run lint` → clean.
2. **R1 importer regression:** `npm run verify:importer 2>&1 | tee scripts/.cache/verify-importer-r1.txt`
   → all cases green including new `[net] ravelry` cases (enrichment happy path returns the
   `ravelry` block; a garbage permalink logs fall-through and returns OG-shaped output).
3. **R1 schema:** `npm run verify:fresh 2>&1 | tee scripts/.cache/verify-fresh-r1.txt` → green
   (migration applies to fresh `pb_data`; rules matrix unchanged).
4. **R1 manual:** paste a real Ravelry crochet-pattern URL into the Paste-a-link door in dev →
   form shows title, designer, craft=crochet, CYC weight, hook mm, gauge text, yardage,
   difficulty, notes, thumbnail; "imported from ravelry.com" chip visible.
5. **R2 search:** type "granny square" in the search door → crochet result cards with thumbs →
   tap → prefilled form. 📱 via `tailscale serve`.
6. **R3 (if built):** run the import script twice → second run creates zero new records
   (idempotency proof); spot-check shelves/tags/thumbnails on a handful of imports.
