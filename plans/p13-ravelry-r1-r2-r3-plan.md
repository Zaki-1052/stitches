# p13 — Ravelry R1 + R2 + R3 (enrichment, search door, import script)

## Context

`docs/RAVELRY.md` (approved 2026-07-17) pulled the SPEC §17 Ravelry backlog item forward; root
`PLAN.md` holds the working plan. This session builds all three phases in one sitting: **R1**
importer enrichment (paste a Ravelry link → fully pre-filled form), **R2** the in-app search
door, **R3** the one-time import script for Cece's saves — written and runbook'd now, live-run
later once her personal key lands in `.env`. GDPR-export fallback parser: deferred (Zara,
this session). No new npm dependencies anywhere.

**Zara's picks (AskUserQuestion, this session):**
1. **Search door = 4th door everywhere** — Home's DoorsRow becomes a 2×2 grid, the dock ➕
   sheet gains a fourth row; both open a new dockless `/patterns/search-ravelry` screen.
   Order per approved mockup: Paste a link · Add a file · Type it in · Search Ravelry.
   Deviates from DESIGN §9's three-door list → DECISIONS line + DESIGN wording update.
2. **R3 = full script + runbook** (`scripts/ravelry-import.mjs` + `docs/ravelry-import-runbook.md`),
   not instructions-only. Cannot run this session; parks until Cece's key arrives.
3. **GDPR-export zip parser deferred** — Cece already agreed to make a key (DECISIONS 2026-07-18).

**Facts verified against live fixtures (`scripts/.cache/ravelry-*.json`) and code:**
- `difficulty_count` is `null` in the wild (not just `0`) — crochet fixture has
  `difficulty_average: 0, difficulty_count: null`. Mapper treats falsy count as unset.
- The chip reads `site_name ?? hostLabel(url)` (`usePasteLinkDoor.ts:119`) → mapper leaves
  `site_name: null` so the chip says "imported from ravelry.com" untouched, while the form's
  `source_name` field separately prefills `"Ravelry"` (matches seed data + placeholder).
- Search items: `id`, `name`, `permalink`, `pattern_author.name`, `free`,
  `first_photo.square_url/small_url` (nullable); paginator `{page, page_count, results}`.
- Hook sizes: `crochet: true` entries, `metric` mm, smallest wins; `hook`/`us` ignored.
- `pattern_needle_sizes` fixture entry: `{metric: 4.5, crochet: true, hook: null}` on 7542093.
- `removeByName(fieldName)` exists in PB v0.39.6 JSVM (`pb_data/types.d.ts:12316`) — down
  migration is real, not guessed.
- `dev.sh` does NOT load `.env` for the importer — fail-fast `RAVELRY_BASIC*` requires dev.sh
  to source it (if-form, safe under `set -euo pipefail`).
- verify:importer already spends 15/20 of user A's rate budget; +3 Ravelry cases = 18/20.

## Files

```
importer/src/ravelry/types.ts        NEW — Pattern (full) subset, RavelryExtractBlock, search item
importer/src/ravelry/detect.ts       NEW — URL → permalink matcher (pure)
importer/src/ravelry/client.ts       NEW — Basic auth GET + ETag LRU cache + RavelryApiError
importer/src/ravelry/map.ts          NEW — CYC table, difficulty buckets, hook pick, trim-all
importer/src/routes/extract.ts       MOD — Ravelry branch, logged fall-through
importer/src/routes/ravelrySearch.ts NEW — POST /import/ravelry/search
importer/src/app.ts                  MOD — register search route + body schema
importer/src/config.ts               MOD — requireEnv(RAVELRY_BASIC_USER / RAVELRY_BASIC)
scripts/dev.sh                       MOD — source .env in the importer subshell
pb/pb_migrations/*_patterns_ravelry.js NEW — ravelry_id + ravelry_fetched_at
web/src/features/patterns/importerClient.ts   MOD — RavelryBlock, searchRavelry()
web/src/features/patterns/pendingUrlImport.ts MOD — ravelryProvenance
web/src/features/patterns/useUrlImport.ts     NEW — generic extract→stash→navigate tail
web/src/features/patterns/usePasteLinkDoor.ts MOD — delegates to useUrlImport; ravelry prefill
web/src/features/patterns/formData.ts         MOD — optional ravelryProvenance appends
web/src/routes/PatternFormPage.tsx            MOD — pass provenance on create
web/src/lib/schema.ts                         MOD — PatternRecord read-shape fields
web/src/features/patterns/components/PatternForm.tsx   MOD — detailsOpen on create prefill
web/src/routes/RavelrySearchPage.tsx          NEW — search screen (submit-on-enter, append paging)
web/src/features/patterns/components/RavelrySearchCard.tsx NEW — result card (CDN thumb, free pill)
web/src/features/home/components/DoorsRow.tsx MOD — 2×2, coral Search tile
web/src/features/patterns/components/QuickAddSheet.tsx MOD — 4th Door row
web/src/main.tsx                              MOD — /patterns/search-ravelry route
scripts/ravelry-import.mjs           NEW — R3 one-time import (--smoke / --run)
scripts/verify/importer-check.mjs    MOD — 3 [net] ravelry cases
docs/ravelry-import-runbook.md       NEW — Cece key → smoke → run → delete key
.env.example                         MOD — R3 owner-account vars (commented)
package.json                         MOD — ravelry:import / ravelry:import:smoke
docs/DECISIONS.md · docs/DESIGN.md §9 · logs/2026-07-19_ravelry-r1-r2-r3.md
```

## Verification (Zara runs; boxes in PLAN.md tick only on her confirmation)

1. `cd importer && npm run typecheck` + `npm run lint` (Claude runs, must be green).
2. `npm run verify:importer 2>&1 | tee scripts/.cache/verify-importer-r1.txt` — all green incl.
   the three `[net] ravelry` cases.
3. `npm run verify:fresh 2>&1 | tee scripts/.cache/verify-fresh-r1.txt` — migration applies clean.
4. Manual: paste a real Ravelry crochet URL → prefilled Details/craft/notes + chip.
5. R2: 📱 `tailscale serve` device pass — search "granny square" → cards → tap → prefilled form.
6. R3: parks until Cece's key; smoke → run → idempotency re-run per the runbook.
