# Session 1.1 — Full schema & rules (Phase 1, first session)

> On approval, first implementation step is saving this plan into the repo as
> `logs/p03-session-1.1-schema-rules.md` (repo convention: `logs/p01-plan.md`, `p02-plan.md`).

## Context

PLAN.md Session 1.1: make the **entire SPEC §7 data model exist, enforced, and provably so** —
one migration set for `tags / patterns / pattern_attachments / projects / journal_entries /
counters`, an extended seed, and `scripts/rules-check.mjs` proving the access matrix
(anonymous / owner / other-user) against every collection. Acceptance: migrations apply cleanly
to a fresh `pb_data`; rules-check green across the full matrix, and it becomes a permanent
regression test (PLAN re-runs it in Sessions 1.3, 4.1, and against prod in 5.1 — so it must be
self-contained: two user creds only, **no superuser**, cleans up after itself).

### Verified platform facts (PB v0.39.6 — from `pb/pb_data/types.d.ts`, pocketbase.io docs, and strings in the pinned binary)

- Migrations create collections via `new Collection({type:"base", name, rules…, fields:[…], indexes:[…]})`
  + `app.save()`; down = `app.delete(app.findCollectionByNameOrId(name))`. Only `id` is auto-added —
  **`created`/`updated` must be explicit autodate fields** per collection.
- **No field type has a default-value option.** SPEC's "default crochet/saved/private/planned/0"
  cannot live in the schema. Empty select ≠ `"friends"`, so private-by-default falls out of the
  rules; client forms supply defaults in Session 1.2. Number zero-value is 0.
- Record delete blocks **only for required** non-cascade references ("…not part of a required
  relation reference"); **optional references are silently auto-unset** — so SPEC's "deleting a
  pattern with linked projects is blocked" is false as written and needs a delete-rule guard.
- Rules support `@request.body.X`, `:isset`, `:changed` (documented ≡ `isset=false || body.X = X`),
  `:length` (array/relation length check), relation traversal (`pattern.owner`), back-relations
  (`projects_via_pattern`, resolved as multiple).
- List requests with a failing rule return **200 + filtered/empty items**; view → 404;
  create/update/delete denials → 400/403/404. rules-check asserts with these semantics.
- File `?thumb=` variants are served **only for sizes pre-declared** in the field's `thumbs`
  option; unknown sizes silently return the original.

### Decisions made with Zara (this planning session)

1. **Harden rules beyond literal SPEC §7**: auth-gate prefix on visibility-aware read rules
   (literal rules leak shared records to anonymous); `:changed` locks on parent relations
   (blocks cross-user re-pointing/injection); `project.owner` guard on counters create.
2. **Pattern blocked-while-linked = delete-rule guard** (server-side, structural), not client-side.
3. **`owner` relations: `cascadeDelete: true`** on all six collections (account deletion wipes
   that person's content; SPEC was silent).
4. **Seed = patterns + tags only** (3 patterns/user, ≥1 shared + ≥1 private each; 5 tags covering
   all five colors). Projects/journal/counters fixtures are rules-check's own, self-provisioned.

---

## Deliverable 1 — Migration `pb/pb_migrations/<epoch>_create_library_schema.js` (new)

Epoch prefix = actual unix time at write (must sort after `1783806920`). Same idiom as the 0.2
migration: `/// <reference path="../pb_data/types.d.ts" />`, one `migrate(up, down)`.

**Up** creates, in dependency order: `tags → patterns → pattern_attachments → projects →
journal_entries → counters`. `users` id via `app.findCollectionByNameOrId('users').id`; each
subsequent `collectionId` from the just-saved collection. `counters.resets_with` (self-relation)
is added **after** the first `app.save(counters)` (needs its own collection id), then re-saved.
**Down** deletes in reverse order.

**Every collection**: `owner` relation → users (required, maxSelect 1, **cascadeDelete: true**),
plus explicit `{name:"created", type:"autodate", onCreate:true}` and
`{name:"updated", type:"autodate", onCreate:true, onUpdate:true}`.

All image file fields: `mimeTypes ["image/jpeg","image/png","image/webp","image/gif"]` (SPEC §8),
`thumbs ["100x100","400x0","800x0"]` — **including `projects.cover` and `journal_entries.photos`**
(validation finding: SPEC §8's "lists never load originals" breaks silently without them).

### Fields (beyond owner/created/updated)

| Collection | Fields |
|---|---|
| **tags** | `name` text required · `color` select [blue, coral, lilac, mint, butter] |
| **patterns** | `title` text required · `designer` text · `source_url` url · `source_name` text · `craft` select [crochet, knitting, tunisian, other] · `yarn_weight` select [cyc_0…cyc_8] · `hook_mm` number · `gauge` text · `yardage` number · `yardage_max` number · `difficulty` select [beginner, easy, intermediate, experienced] · `shelf` select [saved, want_to_make, queued] · `visibility` select [private, friends] · `tags` relation→tags multiple (maxSelect 99, cascadeDelete false) · `thumbnail` file 1 × ≤5 MB image · `photos` file ≤10 × ≤8 MB image · `notes` editor |
| **pattern_attachments** | `pattern` relation→patterns required, **cascadeDelete: true** · `label` text · `files` file ≤10 × ≤30 MB, mime [application/pdf, image/jpeg, image/png, image/webp], **protected: true** · `pattern_text` editor |
| **projects** | `pattern` relation→patterns **optional**, cascadeDelete false · `name` text required · `status` select [planned, in_progress, finished, frogged, hibernating] · `started_on` date · `finished_on` date · `hook_mm` number · `yarn_used` text · `summary` editor · `cover` file 1 × ≤8 MB image · `visibility` select [private, friends] |
| **journal_entries** | `project` relation→projects required, **cascadeDelete: true** · `entry_date` date required · `body` editor · `photos` file ≤6 × ≤8 MB image |
| **counters** | `project` relation→projects required, **cascadeDelete: true** · `label` text required · `value` number min 0 · `target` number · `resets_with` relation→counters single optional, cascadeDelete false (same-project + no-loops stays client-enforced per SPEC) |

### Indexes

```sql
CREATE UNIQUE INDEX idx_tags_owner_name       ON tags (owner, name)
CREATE INDEX        idx_patterns_owner        ON patterns (owner)
CREATE INDEX        idx_projects_owner        ON projects (owner)
CREATE INDEX        idx_journal_entries_project ON journal_entries (project)
CREATE INDEX        idx_counters_project      ON counters (project)
```

### API rules (hardened per decision 1; `OG` = owner-transfer guard from SPEC, verbatim: `(@request.body.owner:isset = false || @request.body.owner = @request.auth.id)`)

| Collection | list / view | create | update | delete |
|---|---|---|---|---|
| **tags** | `@request.auth.id != ""` | `owner = @request.auth.id` | `owner = @request.auth.id && OG` | `owner = @request.auth.id` |
| **patterns** | `@request.auth.id != "" && (owner = @request.auth.id \|\| visibility = "friends")` | `owner = @request.auth.id` | `owner = @request.auth.id && OG` | `owner = @request.auth.id && projects_via_pattern.id:length = 0` |
| **pattern_attachments** | `owner = @request.auth.id` | `owner = @request.auth.id && pattern.owner = @request.auth.id` | `owner = @request.auth.id && OG && @request.body.pattern:changed = false` | `owner = @request.auth.id` |
| **projects** | `@request.auth.id != "" && (owner = @request.auth.id \|\| visibility = "friends")` | `owner = @request.auth.id && (pattern = "" \|\| pattern.owner = @request.auth.id \|\| pattern.visibility = "friends")` | `owner = @request.auth.id && OG && (@request.body.pattern:changed = false \|\| @request.body.pattern = "" \|\| pattern.owner = @request.auth.id \|\| pattern.visibility = "friends")` | `owner = @request.auth.id` |
| **journal_entries** | `@request.auth.id != "" && (owner = @request.auth.id \|\| project.visibility = "friends")` | `owner = @request.auth.id && project.owner = @request.auth.id` | `owner = @request.auth.id && OG && @request.body.project:changed = false` | `owner = @request.auth.id` |
| **counters** | `owner = @request.auth.id` | `owner = @request.auth.id && project.owner = @request.auth.id` | `owner = @request.auth.id && OG && @request.body.project:changed = false` | `owner = @request.auth.id` |

**Two verify-empirically rule idioms** (resolved during implementation; migration save validates
syntax, rules-check proves behavior — per SPEC §16 #5 there is NO client-side fallback; if neither
form works, stop and consult Zara):

- Patterns delete guard: primary `projects_via_pattern.id:length = 0`; fallback candidate
  `projects_via_pattern.id = ""` (match-all over empty back-relation).
- Projects update rule's `pattern.owner/.visibility` traversal after a re-point (old vs new value
  resolution) — rules-check has explicit allow/deny cases either way.

## Deliverable 2 — `scripts/rules-check.mjs` (new) + `verify:rules` npm script

Follows seed.mjs conventions: path comment header, env-only config, fail-loud, no fallbacks.
Env: `PB_URL` (default `http://127.0.0.1:8090`), `SEED_USER1_EMAIL/PASSWORD`,
`SEED_USER2_EMAIL/PASSWORD`. Three personas: `anon`, `A`, `B` (separate PocketBase clients;
`pocketbase` SDK resolves from the hoisted workspace install). All fixture names prefixed
`[rules-check]`; **all filters built with `pb.filter('x = {:y}', …)` binding**, never string
interpolation.

**Phase 0 — sweep** (idempotency; also runs as the exit path): per persona, delete leftovers
children→parents: counters → journal_entries → projects (first `update {pattern: ""}` to unlink)
→ pattern_attachments → patterns → tags. This ordering is load-bearing: a crashed prior run must
never brick the next one against the delete guard (validation finding 4).

**Phase 1 — fixtures.** As A: `tag_a`; `pattern_priv_A`; `pattern_shared_A` (visibility friends,
tags [tag_a]); `attachment_A` on `pattern_shared_A` (label + pattern_text only — files field is
optional, record-level rules don't need an upload); `project_priv_A`; `project_shared_A`;
`entry_on_priv_A`; `entry_on_shared_A`; `counter_A` on `project_shared_A`. As B: `tag_b`
(**same name as `tag_a`** — cross-owner uniqueness positive case), `pattern_B` (private),
`project_B`.

**Phase 2 — matrix**, table-driven; expected outcome parameterized per
(collection, **target visibility**, persona, op) — not persona alone (validation finding 5):

- **anonymous**: list → 0 items on every collection (this is the check the literal SPEC rules
  would fail); view → 404 for every fixture **including shared ones**; create denied everywhere
  including `users` (the invite gate, regression from 0.2); update/delete denied.
- **owner (A)**: full positive path — list shows both fixtures, view 200, create OK, update of an
  ordinary field succeeds (**positive-path proof that `:changed` locks don't brick updates**,
  finding 7), delete deferred to Phase 3.
- **other (B)**:
  - patterns/projects: shared fixture **visible** (list + view 200); private fixture invisible
    (absent from list, view 404); update/delete of A's records → denied.
  - journal_entries: `entry_on_shared_A` visible; `entry_on_priv_A` invisible (inherited visibility).
  - **pattern_attachments & counters: invisible even on shared parents** — the headline
    "attachments invisible to a friend even when the pattern is shared", plus the counters twin.
  - create-on-A's-parent denied, **three explicit cases** (finding 6): attachment on
    `pattern_shared_A`, entry on `project_shared_A`, counter on `project_shared_A`.
  - owner-transfer: A updating own pattern with `owner: B` → denied (OG guard).
  - re-parent locks (finding 7): A moving `entry_on_shared_A` to `project_priv_A`, the attachment
    to another pattern, the counter to another project → all denied (`:changed = false`).
  - projects.pattern write guard (finding 2): B creates project linking `pattern_shared_A` →
    **allowed** (the make-a-friend's-pattern flow); linking `pattern_priv_A` → denied; B re-points
    `project_B` to `pattern_priv_A` → denied; B clears the link → allowed.
  - tags: B lists/views A's tags (200 — shared patterns must render tags); B update/delete A's tag
    denied; A duplicate `(owner, name)` create → 400 (unique index); `tag_a`/`tag_b` same-name
    coexistence already proven by fixtures (finding 8).
- **users**: anon list empty/denied; B lists users (200, authed read per §7); B update A denied.

**Phase 3 — behavior & cascade proofs (doubles as cleanup):**

1. B's project links `pattern_shared_A` → A's delete of it → **denied** (blocked-while-linked);
   B unlinks → A's delete succeeds → `attachment_A` view now 404 (**cascade with pattern**).
2. A deletes `project_shared_A` → `entry_on_shared_A` and `counter_A` both 404 (**cascade ON**).
3. Delete every remaining fixture as its owner; final sweep re-run leaves zero `[rules-check]`
   records (safe-for-prod property).

Output: one `PASS/FAIL expected=… got=…` line per check + summary count; any FAIL → exit 1; raw
PB error bodies printed on unexpected statuses. Root `package.json` gains
`"verify:rules": "node scripts/rules-check.mjs"`.

## Deliverable 3 — `scripts/seed.mjs` extension

After the existing user-creation block (unchanged): authenticate **as each demo user** (their
creds are already in env) so seeding itself exercises the create rules.

- user1: tags `amigurumi`(coral), `wearables`(blue), `gifts`(butter); patterns **Bee Amigurumi**
  (friends, tagged, cyc_2, 3.5 mm, easy), **Granny Square Cardigan** (private, cyc_4, 5.0 mm,
  intermediate, want_to_make), **Mushroom Keychain** (friends, cyc_2, 3.0 mm, beginner, queued).
- user2: tags `blankets`(mint), `quick wins`(lilac); patterns **Ripple Blanket** (friends, cyc_4,
  5.5 mm), **Cotton Dishcloth** (private, cyc_3, 4.0 mm), **Star Coaster** (private, cyc_2).
- Every record sends explicit `owner` and `visibility`; realistic `designer/gauge/yardage/notes`
  sprinkled in; **no image files** (pipeline is Session 1.2).
- Idempotent via `pb.filter()` `(owner, title)` / `(owner, name)` lookups (finding 9); per-record
  `OK/SKIP` lines; fail-loud.

## Deliverable 4 — docs & log

Append to `docs/DECISIONS.md` (one line each, date · what · why):
1. Rules hardened beyond SPEC §7 literal text (auth-gate prefix, `:changed` parent locks,
   counters/projects create guards) · literal rules leaked shared records to anonymous and allowed
   cross-user re-pointing.
2. patterns deleteRule gains `projects_via_pattern` guard · v0.39.6 auto-unlinks optional refs
   (blocks only required ones); SPEC's "blocked" mechanism claim was wrong.
3. `owner` relations cascadeDelete: true · account deletion wipes that user's content; SPEC silent.
4. PB v0.39.6 has no schema-level field defaults · SPEC's "default …" selects ship optional;
   empty = default semantics; forms supply defaults in 1.2.
5. `thumbs` lists provisioned on all image fields · `?thumb=` only serves pre-declared sizes.

Session log: `logs/<date>_session-1.1-schema-rules.md` (40–60 lines, per CLAUDE.md).
PLAN.md acceptance boxes: check only after Zara's verification run is green.

## Files touched

- `pb/pb_migrations/<epoch>_create_library_schema.js` — **new** (the migration set)
- `scripts/rules-check.mjs` — **new**
- `scripts/seed.mjs` — extended (additive; existing user block untouched)
- `package.json` — `verify:rules` script
- `docs/DECISIONS.md` — 5 lines · `logs/p03-session-1.1-schema-rules.md` (this plan) · session log

## Verification

**Claude runs** (allowed: linters/pure checks): `node --check scripts/rules-check.mjs`,
`node --check scripts/seed.mjs`, `npm run lint` (web untouched — regression sanity).

**Zara runs** (complete, literal; creds from her env/password manager):

```bash
# 1. fresh pb_data (acceptance #1) — keep the old one as a backup
mv pb/pb_data pb/pb_data.pre-1.1.bak

# 2. boot — watch for both migrations applying cleanly
npm run dev 2>&1 | tee logs/dev-1.1-fresh.txt

# 3. (second terminal) superuser + seed — same flow as README from Session 0.2
./pb/pocketbase superuser upsert SUPERUSER_EMAIL SUPERUSER_PASSWORD --dir pb/pb_data
SUPERUSER_EMAIL=… SUPERUSER_PASSWORD=… \
SEED_USER1_EMAIL=… SEED_USER1_PASSWORD=… SEED_USER1_NAME=… \
SEED_USER2_EMAIL=… SEED_USER2_PASSWORD=… SEED_USER2_NAME=… \
  npm run seed 2>&1 | tee logs/seed-1.1.txt

# 4. the matrix (acceptance #2) — then run it AGAIN to prove sweep idempotency
SEED_USER1_EMAIL=… SEED_USER1_PASSWORD=… SEED_USER2_EMAIL=… SEED_USER2_PASSWORD=… \
  npm run verify:rules 2>&1 | tee logs/rules-check-1.1.txt
```

Green = both acceptance boxes; also confirms fresh-DB login + seeded library visible in the app.
If the delete-guard idiom fails empirically (both forms), **stop and report to Zara** — no silent
fallback.
