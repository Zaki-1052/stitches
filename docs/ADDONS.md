# ADDONS.md — Phase 6 Add-ons Spec

*Version 1.0 · July 2026 · Status: **approved design, not yet built**. Companions: `SPEC.md`
(architecture), `DESIGN.md` (visual system), `PLAN.md` (Phase 6 session briefs), `RAVELRY.md`
(the precedent this doc follows). Spec session: 2026-07-19 — three parallel exploration tracks
plus ten decisions made with Zara (logged in `DECISIONS.md`).*

---

## 1. What this is

Cece approved four features from SPEC §17's backlog: *"full offline browsing · public share
links · desktop clipper extension · yarn stash."* This spec defines all four to buildable depth.

| # | Feature | Sessions | Depends on |
|---|---|---|---|
| §2 | **Yarn stash** — a linked, browsable stash under Library | 6.1 | nothing |
| §3 | **Full offline browsing** — the whole library on a plane, vault included | 6.2 + 6.3 | nothing |
| §4 | **Public share links** — a link Cece can text her mom | 6.4 | useful post-Phase 5 |
| §5 | **Desktop clipper** — one click from a browser tab to the save form | 6.5 | needs a reachable URL |

Build order (Zara's pick): stash → offline → share → clipper. Everything is local-dev friendly;
§4/§5 only become genuinely useful once the app is live on the VPS.

Standing rules inherited by every session here: schema only via `pb_migrations`; security lives
in PB API rules (with one deliberate, documented exception in §4 — a `pb_hooks` route); colors
and fonts only via tokens; new UI copy avoids em-dashes; microcopy drafts below are **pending
Zara's approval** at each build session, per convention.

## 2. Yarn stash *(Session 6.1)*

### 2.1 Schema — one migration, two phases

`pb/pb_migrations/<ts>_yarn_stash.js`, mirroring the Session 1.1 idioms exactly (module-local
`ownedFields()`/`IMAGE_MIMES`/`IMAGE_THUMBS` redeclared — migrations share no modules; no
schema-level defaults exist in v0.39.6, forms supply display defaults).

**Phase 1 — create `yarns`:**

| field | type | notes |
|---|---|---|
| owner | relation → users, required, cascadeDelete | via `ownedFields()` |
| name | text, required | the yarn/line name; the one identifying field |
| brand | text | |
| colorway | text | freeform; real yarn colors are not patch tokens |
| weight | select cyc_0…cyc_8 | **byte-identical** to `patterns.yarn_weight`'s array; labels via `web/src/lib/cyc.ts` |
| fiber | text | freeform ("80% acrylic, 20% wool") |
| yardage_per_skein | number | |
| skein_count | number, min 0 | no decrement math, ever (Zara's pick: linked, not tracked) |
| photos | file image ≤6 × ≤8 MB, IMAGE_THUMBS | no separate `thumbnail` field — no import door feeds yarns; cards use `photos[0]` |
| notes | editor | TipTap value, dompurify on render |
| visibility | select private · friends | private-by-default via empty-doesn't-match, like patterns |

Index: `CREATE INDEX idx_yarns_owner ON yarns (owner)`. No unique index — re-buying the same
colorway is a legitimate duplicate.

**Phase 2 — edit `projects` in place** (`findCollectionByNameOrId` + `fields.add` + save):
`yarns` relation → yarns, `maxSelect: 99`, **`cascadeDelete: false`**. Down-migration removes
`projects.yarns` first, then deletes the collection.

### 2.2 Rules

Yarns mirror patterns' shape exactly:

```js
listRule / viewRule: AUTHED && (owner = @request.auth.id || visibility = "friends")
createRule:          owner = @request.auth.id
updateRule:          OWNER && OWNER_LOCK
deleteRule:          owner = @request.auth.id          // no back-relation guard — see below
```

**Deletion = quiet unlink (Zara's pick, deviates from the pattern-delete precedent).** Yarn is
consumable stash; "used the last skein, tidying up" is the normal delete. v0.39.6 auto-unlinks
optional relations on delete (DECISIONS 2026-07-11), so a deleted yarn silently leaves every
project's `yarns` array while projects and journals survive untouched. The delete confirm says
so plainly (§2.5). DECISIONS line at build.

**Link guard on `projects` create/update — verification-first.** Target rule is the full
`PATTERN_LINKABLE` mirror (own *or* friend-shared yarns linkable):

```js
YARN_LINKABLE        = '(yarns = "" || yarns.owner = @request.auth.id || yarns.visibility = "friends")'
YARN_LINKABLE_UPDATE = '(@request.body.yarns:changed = false || …same shape on @request.body.yarns…)'
```

`projects.yarns` is a **multi**-relation, and three PB filter behaviors are unverified against
the pinned binary (verify-at-build #1–4): the ALL-vs-ANY quantifier of bare operators on
multi-relation dot-paths, whether an OR of two dot-path conditions groups per-row or
per-aggregate, and whether an empty array passes vacuously. The build session **proves all
three with rules-check fixtures first** (empty-yarns create; two-own-yarns create; one own + one
friend-shared mixed create; B-links-A's-private-yarn denial). Only if the per-row OR genuinely
misgroups in v0.39.6 does the rule fall back to own-yarns-only (drop the `visibility` arm) with
a DECISIONS line — a real wall, not a defensive cut.

### 2.3 Web

```
web/src/features/yarn/
├── queries.ts       yarnKeys (all/lists/list(viewerId,filters)/details/detail/usedIn) + hooks
├── mutations.ts     useCreateYarn / useUpdateYarn / useDeleteYarn
├── formData.ts      buildYarnFormData (photos add/remove per patterns/formData.ts)
├── urlParams.ts     YarnFilters { q, weight[] } parse/serialize
└── components/      YarnCard · YarnEmptyState · YarnFilterSheet · YarnUsedInList
```

- `lib/schema.ts` gains `YarnRecord`, `yarnFormSchema`/defaults/`yarnToFormValues`, and
  `ProjectRecord.yarns: string[]` + `expand.yarns`.
- Routes: `/yarn` joins the **eager** tab children; `/yarn/new`, `/yarn/:id`, `/yarn/:id/edit`
  join the lazy set with the `key={location.key}` form remount (DECISIONS 2026-07-15).
- **Library tabs (Zara's pick):** the Library dock slot goes active on
  `pathname.startsWith('/patterns') || startsWith('/yarn')` via a small `useLocation()` wrapper
  (NavLink can't express two roots); tapping the dock always lands `/patterns`. A shared
  segmented control (`LibraryTabs`, two pills: Patterns · Yarn) tops both pages; each route
  keeps its own independent URL filter state.
- List queries carry explicit `requestKey`s (the 2026-07-19 auto-cancellation rule).
- **Project ↔ yarn UI:** the project form gains a yarn picker (own yarns + friend-shared,
  matching whatever rule ships); project detail renders yarn chips; yarn detail renders "used
  in" via the reverse query `filter: yarns.id ?= {:id}` (the existing tag-filter `?=` idiom).
- **Yarn chip look (DESIGN §3 addition at build):** a neutral pill — `base-100` fill,
  `base-300` border — with a tiny round `photos[0]` `?thumb=100x100` swatch + brand/name text,
  tap → `/yarn/:id`. Deliberately *not* patch-colored: the swatch shows the yarn's actual
  photographed color; forcing a patch token would be decoration, which §3 forbids.
- Add door: `/yarn` gets its own "+ Add yarn" affordance (the `/projects` → `/projects/new`
  idiom). The dock ➕ stays pattern-doors-only.

### 2.4 Seed & rules-check

- `seed.mjs`: 2–3 yarns per demo user via the `ensureRecord` idiom — at least one private and
  one shared each, spanning weights, one linked to an existing seed project.
- `rules-check.mjs` (extended **in place**): `yarns` joins the anon-empty sweep and final
  leftover check; new `· yarns` matrix section (A/B/anon, patterns-shaped); new
  `· projects ↔ yarns link guard` section with the §2.2 fixtures; cascade proof — delete a
  linked yarn, re-fetch the project, assert the id auto-unlinked.

### 2.5 Microcopy drafts (pending approval; no em-dashes)

- Stash empty: **"No yarn yet. Your basket is ready when you are."** + "Add your first yarn"
- Search empty: reuse the approved *"Nothing matches, yet — try loosening a filter."* verbatim
  (existing copy keeps its dash)
- Used-in empty: **"Not in a project yet."**
- Delete confirm: **"Delete this yarn? Projects that used it keep their story. The yarn leaves
  your stash."**
- Visibility helper: **"Friends can see this yarn in your stash. Only you can change it."**

## 3. Full offline browsing *(Sessions 6.2 + 6.3)*

Today the app is flaky-tolerant, not offline-first: shell precached, counter outbox, but every
read needs network and — the real killer — **a cold offline reopen logs you out**
(`auth.tsx` clears the store on *any* `authRefresh` rejection) and dead-ends at `/login`.
Zara's picks: full-library proactive sync (not visited-only), and the vault gets a per-file
owner-only "Keep on this phone" toggle.

### 3.1 Auth boot fix *(6.2)*

Verified against the installed SDK: `ClientResponseError` wraps a raw network `TypeError` with
`status: 0` / `isAbort: false` — the exact discrimination `outbox.ts`'s `isRetryable()` already
relies on. The boot effect becomes:

- Definitive rejection (`status` ≥ 400, not abort) → clear the store (token truly invalid).
- Network failure / abort → **keep the session**, set `unverified: true` on the auth context,
  re-run `authRefresh` on `online`/`visibilitychange` until it resolves for real.

This alone un-bricks offline reopen; everything else in §3 builds on it.

### 3.2 Query persistence *(6.2)*

`@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister` +
`idb-keyval` (§6 pins). `persistQueryClient` with:

- `buster: __APP_VERSION__` (existing Vite define) — every release invalidates the persisted
  blob wholesale, so persisted shapes never drift against new code.
- Generous `maxAge` (days) — persistence is about surviving app kills; freshness stays
  `staleTime`'s job on rehydration.
- `shouldDehydrateQuery` excludes **`['fileToken']`** (a ~2-minute credential must never be
  persisted). Mutation cache stays unpersisted (the default; don't flip it). The counter
  outbox is untouched — it already survives kills by design.

### 3.3 Full-library sync *(6.2)*

`web/src/lib/sync.ts` — a lib-level module in the `outbox.ts` mold (module init, storage-backed
state, `useSyncExternalStore` hook). State under `stitches:sync:v1`, owner-scoped.

- **Fetches** the canonical unfiltered list per collection: patterns, projects, tags, yarns,
  counters (mine), friends feed — and **one** unfiltered `journal_entries` sweep (the list rule
  already scopes it to owner + friend-shared), grouped client-side into per-project
  `entryKeys.forProject` caches. Detail caches (`patternKeys.detail(id)` etc.) are seeded from
  the list rows via `setQueryData`, so any record's detail opens offline without ever having
  been visited.
- **Triggers:** boot `authRefresh` success · Settings "Sync now" · the `online` event, gated by
  `SYNC_MIN_INTERVAL_MS` (10 min) so flaky-signal blips don't re-sync in a loop.
- **Surfacing:** `useSyncStatus()` → `{ lastSyncedAt, inProgress, error }`; a new
  `features/settings/components/OfflineCard.tsx` shows "Last synced {relative}" + **Sync now**,
  and hosts the §3.6 kept-files summary.
- **Known v1 limit (DECISIONS line at build):** a filter/search combination never run online
  shows the normal paused/cached-less state offline — server-side filtering isn't replayed
  client-side. The unfiltered browse, every detail, and every journal are the guarantee.

### 3.4 Thumbnail warming & `lib/files.ts` *(6.2)*

The SW's CacheFirst matches **exact URL strings**, and thumb URLs are currently built inline at
~10 call sites with per-context sizes. New `lib/files.ts` exporting `thumbUrl(record, filename,
context)` centralizes the size map (chips `100x100` · grids `400x0` · hero/detail `800x0`);
all call sites refactor onto it; `sync.ts` prefetches exactly those URLs (fire GETs, let the SW
store them). Raise the thumbnails cache `maxEntries` 300 → **2000** (30-day expiry stays) —
sanity-check real usage against `navigator.storage.estimate()` on device before settling the
number (DECISIONS line).

### 3.5 Offline UX *(6.2)*

- `lib/network.ts` → `useOnlineStatus()` (`navigator.onLine` + `online`/`offline` listeners).
- **Indicator:** AppHeader shows a small `CloudOff` (name verified against pinned lucide
  1.24.0) whenever offline or `unverified`, labeled **"Offline. Showing what's saved."** The
  counter surface's syncing stitch stays its own, unchanged.
- **Reads:** TanStack's default `networkMode: 'online'` already *pauses* queries offline while
  rendering cached data — with §3.2/§3.3 in place, read screens work offline with no
  per-screen branching.
- **Writes:** counters keep their outbox. Every other mutation pre-flight-checks
  `useOnlineStatus()` and fails **in place, legibly** (the failure-UX rule): the Save stays
  put with **"You're offline. Try again once you're back online."** (via the shared PB-error
  normalizer, new offline branch). No silent queue-and-fire-later for forms — a Save landing
  minutes after the user walked away is worse than an honest no.

### 3.6 The vault on the go — "Keep on this phone" *(6.3)*

- **Toggle** on each `AttachmentsCard` row (owner-only surface already). On enable: one-shot
  `pb.files.getToken()` → fetch the protected URL → store the Blob in `idb-keyval` under an
  **owner-scoped key** `${ownerId}:${attachmentId}:${filename}`, in a store separate from the
  query-persist blob (megabyte binaries must not ride every cache rehydrate). `pattern_text`
  needs nothing — it's record data, §3.2 covers it.
- **Viewing:** `useKeptAttachments(patternId)` builds object URLs on mount and revokes via the
  existing `useRevokeOnUnmount` convention, so View stays a synchronous `<a href>` (the iOS
  popup-blocker rule). 📱 device test: iOS Safari's `blob:` PDF handling in a new tab; if it
  misbehaves, the fallback is an in-app pdfjs viewer (dep already installed) — decision logged
  either way.
- **Sizes:** per-file human-readable size next to the toggle; aggregate in `OfflineCard`
  ("3 files kept · 41 MB") + **Clear all kept files** (plain confirm).
- **Cleanup:** attachment delete mutation also deletes the IDB key; logout/identity change
  sweeps keys not scoped to the new owner (the outbox `onChange` idiom). Call
  `navigator.storage.persist()` once, feature-detected, on first keep — its iOS effect is
  unreliable (verify-at-build #5), so the microcopy stays honest.
- **SW note:** protected URLs remain NetworkOnly and are never cached; kept files live only in
  the explicit IDB store. The §1 copyright posture (owner-only, structurally) is unchanged —
  this is the owner's own device, opt-in, per file.

Microcopy drafts (pending approval): toggle **"Keep on this phone"** · kept badge **"On this
phone"** · caption **"Saved for offline reading. iOS may clear it if space runs very low."** ·
un-kept offline View → **"This file needs the internet. Keep it on this phone to read it
offline."** · clear-all confirm **"Remove kept files from this phone? They stay safe in your
vault."** · sync error **"Sync didn't finish. Try again?"**

## 4. Public share links *(Session 6.4)*

The first anonymous-facing surface. Design principle (Zara's pick): **the API collections keep
their zero-anonymous invariant** — no rule ever admits an unauthenticated request; public
access happens exclusively through one server-rendered `pb_hooks` route with an explicit
allowlist. `rules-check`'s "anonymous sees nothing" block stays true forever.

### 4.1 Schema

`pb/pb_migrations/<ts>_share_links.js` — `share_links`:

| field | type | notes |
|---|---|---|
| owner | relation → users, required, cascadeDelete | `ownedFields()` |
| pattern | relation → patterns, optional, maxSelect 1, cascadeDelete | dies with its pattern |
| project | relation → projects, optional, maxSelect 1, cascadeDelete | dies with its project |
| token | text, required | the public slug |
| revoked_at | date, optional | empty = active; a timestamp beats a bool (no schema defaults in 0.39.6, and "revoked on {date}" comes free) |

Indexes: `CREATE UNIQUE INDEX … ON share_links (token)` plus **partial unique indexes**
`ON share_links (pattern) WHERE pattern != ''` and `(project) WHERE project != ''` — at most
one link per target, so **regenerate is an in-place update** (new token, cleared `revoked_at`),
never a row history.

### 4.2 Rules — owner-only everywhere

```js
XOR_TARGET   = '((pattern != "" && project = "") || (pattern = "" && project != ""))'
TARGET_OWNED = '(pattern = "" || pattern.owner = @request.auth.id) && (project = "" || project.owner = @request.auth.id)'

listRule / viewRule: OWNER
createRule:          OWNER && XOR_TARGET && TARGET_OWNED
updateRule:          OWNER && OWNER_LOCK && @request.body.pattern:changed = false && @request.body.project:changed = false
deleteRule:          OWNER
```

A link's target is immutable; regenerate/revoke only touch `token`/`revoked_at`. Never
any-authed, never anonymous.

### 4.3 Token minting

Preferred: **server-side** via a record-create hook in `pb_hooks` (`$security.randomString`-
style; exact JSVM hook name/signature is verify-at-build #9), overwriting whatever the client
sent — defense in depth, nearly free since §4.4 stands up `pb_hooks` anyway. Fallback if the
hook API proves awkward on 0.39.6: client-side `crypto.getRandomValues` (18–24 bytes,
base64url, ~144–192 bits) with the unique index as backstop. No `expires` field — revocation
is the kill switch; YAGNI at this scale (DECISIONS line).

### 4.4 The `pb_hooks` route — `pb/pb_hooks/share.pb.js`

`GET /share/{token}` (registration API, path-param accessor, record-lookup binding, and HTML
response helper are all verify-at-build #9–10 against the pinned binary):

1. Look up `share_links` where `token = {token}` and `revoked_at = ''`, app-privilege API.
2. Miss **or** revoked → one uniform 404 page, on-voice: **"This link isn't around anymore."**
3. Pattern branch — explicit allowlist, nothing else: title, designer, craft, weight, hook,
   gauge, yardage(s), difficulty, tags (name + color), thumbnail, photos, notes, source_name.
   **The handler never queries `pattern_attachments` at all** — the guarantee is structural
   (no code path exists), not a filtered response.
4. Project branch: name, status, cover, summary, plus its `journal_entries` (entry_date, body,
   photos). **Never queries `counters`.**

**Photos:** every allowlisted file field is non-protected, and non-protected PB files are
public by URL (verified against PB docs) — the page embeds plain `?thumb=800x0` URLs, no
tokens. Worth saying plainly: those URLs were always fetchable by anyone who had them; the
unguessable token formalizes an existing exposure model rather than creating one. Only the
vault was ever Protected, and it stays out of reach.

**Page:** server-rendered HTML "postcard" — doctype, mobile viewport,
`<meta name="robots" content="noindex, nofollow">`, OG tags (`og:title`, `og:description`
from plain-text-stripped truncated notes/summary, absolute `og:image` `?thumb=800x0`,
`og:type`, `og:url`) + `twitter:card=summary_large_image`, so iMessage/WhatsApp render a
preview card. Inline `<style>` mirroring `theme.css` hex values with a system-font stack —
no coupling to the SPA's hashed assets, so deploys can't break it. Content: hero image, title,
meta chips, tags and notes excerpt for patterns; status + dated journal entries with photo
grids for projects. Cute per DESIGN, no login CTA (visitors can't act anyway). Footer:
**"shared from stitches ♡"**.

### 4.5 Web share UI

`features/shared/components/ShareSheet.tsx` (`kind: 'pattern' | 'project'`), opened from a
`Share2` affordance beside the visibility toggle on both detail pages, owner-only:

- No link yet: explainer + **Create a link**.
- Active: the URL (middle-truncated) + **Copy link** (`navigator.clipboard.writeText`, the
  paste-door clipboard precedent) + **Regenerate** + **Revoke** (destructive-plain confirm).

Microcopy drafts (pending approval): explainer (pattern) **"Anyone with this link can see this
pattern's info and photos, no account needed. Your files stay yours."** · explainer (project)
**"Anyone with this link can see this project and its journal, no account needed. Counters
stay yours."** · active label **"Anyone with this link can view"** · copy toast **"Copied ♡"**
· revoke confirm **"Turn off this link? It stops working right away."** · revoke toast
**"Link turned off."** · regenerate confirm **"Get a fresh link? The old one stops working."**

### 4.6 Wiring

- **Vite proxy:** `'/share' → http://127.0.0.1:8090` (PB's own router serves it).
- **Service worker (easy to miss):** add `/^\/share/` to `navigateFallbackDenylist` — without
  it, an installed-app user tapping a share link gets the SPA shell instead of the hook route.
- **Nginx (SPEC §13 forward edit; Phase 5 builds it):** plain `location /share/ { proxy_pass
  http://127.0.0.1:8090; … }` — no SSE headers needed.
- **`--hooksDir`** (exact flag vs. auto-detection: verify-at-build #11 via
  `pocketbase serve --help`) added to **both** `scripts/dev.sh` and `scripts/verify-fresh.sh`
  — missing it in verify-fresh makes the new checks 404 in a way that looks like a data bug.

### 4.7 rules-check additions (in place)

`share_links` joins the anon-empty sweep + final leftover check; new `· share_links` owner
matrix (A/B/anon) + XOR-violation and non-owned-target create denials; new raw-`fetch()`
section against `/share/{token}` (the `expectFileOk` idiom — this route bypasses the SDK):
happy 200 with the title in the body · revoked → 404 · garbage token → 404 · and the
**attachments-absent proof**: share a pattern that *has* vault files, assert the rendered body
contains neither the attachment text nor any attachment file-URL substring — the end-to-end
proof of "never your files," not a code-inspection claim.

## 5. Desktop clipper *(Session 6.5)*

The web app already accepts `/patterns/new?url=` and runs the whole import pipeline from it —
so the clipper (Zara's pick) is deliberately tiny: **no auth, no API calls, no CORS surface.**
It opens a tab.

### 5.1 Extension — `extension/` at the repo root

```
extension/
├── manifest.json    MV3 · action (no popup) · permissions: contextMenus, storage · icons
├── background.js    action + "Send page to Stitches" context-menu → chrome.tabs.create
├── options.html/js  one field: Stitches base URL (chrome.storage.local)
└── icons/           16/48/128 from the existing app-icon set
```

- Target built via `new URL(base + '/patterns/new')` + `searchParams.set('url', tab.url)` —
  never string concatenation (encoding bugs).
- Non-http(s) tab URLs (`chrome://`, `about:`, `file://`) are a silent no-op guard.
- No `host_permissions`. If `tab.url` turns out empty in the click callbacks (verify-at-build
  #12), add the narrow `activeTab` permission.
- Base URL defaults to `https://stitches.zalibhai.com` (confirm at build, #13); the options
  page lets Zara point it at localhost/tailscale for testing.

### 5.2 `docs/clipper.md`

Load-unpacked walkthrough (chrome://extensions → Developer mode → Load unpacked → pin →
options) + the copy-pasteable **bookmarklet** string (same `encodeURIComponent` construction,
`window.open`) for any other desktop browser. Docs-only, no Settings card (Zara's pick).

### 5.3 Companion fix — login redirect preservation

`ProtectedRoute` currently drops the attempted URL on its `/login` redirect, so a logged-out
clipper tab loses its `?url=` (as does every deep link). Bundled fix: carry path + search into
`/login?redirect=…`, honor it after auth. Small, benefits the whole app.

## 6. New dependencies (record in SPEC §5 + DECISIONS at build; exact pins per `.npmrc`)

| Package | Major policy check |
|---|---|
| `@tanstack/react-query-persist-client` | 5.x, lockstep with installed `@tanstack/react-query` 5.101.2 — AI-known |
| `@tanstack/query-async-storage-persister` | same family/major — AI-known |
| `idb-keyval` | 6.x long-stable — confirm no post-knowledge major before pinning |

Nothing new for §4 (pure PB JSVM) or §5 (dependency-free vanilla extension). Icon names used
(`CloudOff`, `Share2`) are verified against the pinned `lucide-react` 1.24.0 `.d.ts`.

## 7. Verify at build — consolidated

Each session opens by closing its items **empirically** (pinned binary, installed packages,
real iPhone) — never from docs memory. PB v0.39.6 and Chrome post-date AI knowledge.

1. §2 — ALL-vs-ANY quantifier of bare operators on multi-relation dot-paths
   (`yarns.owner = …`) in PB rules.
2. §2 — whether an OR across two multi-relation dot-paths evaluates per-row (needed for the
   full friends-linkable rule) or per-aggregate (fall back to own-only + DECISIONS).
3. §2 — empty multi-relation vacuously passing an ALL condition (zero-yarn creates).
4. §2 — `@request.body.<multiRel>.owner` dot-joins in update rules.
5. §3 — `navigator.storage.persist()` behavior on iOS Safari (expect unreliable; copy stays honest).
6. §3 — iOS Safari `blob:` URL PDF viewing via `<a target="_blank">` (fallback: in-app pdfjs).
7. §3 — File System Access API iOS non-viability (assumed; confirm before ever revisiting).
8. §3 — exact patch pins for the three §6 packages against installed TanStack 5.101.2.
9. §4 — every JSVM symbol: route registration (`routerAdd` top-level vs lifecycle), path-param
   accessor, app-privilege record lookup, HTML response helper, record-create hook for token
   minting.
10. §4 — `pb_hooks` filename convention (`*.pb.js`) on 0.39.6.
11. §4 — `pocketbase serve` hooks-directory flag name (or auto-detection) via `--help`.
12. §5 — `tab.url` availability in MV3 click callbacks without `activeTab`.
13. §5 — prod domain for the extension default.

## 8. Build sessions

Defined as Sessions 6.1–6.5 in `PLAN.md` Phase 6 (goal/build/accept, regression gates,
📱 marks). Per-session implementation briefs land in `plans/` at execution time, per
convention — never ahead. SPEC §7/§11/§12/§13/§17 and DESIGN §3/§8/§9 edits land with the
session that makes them true, with DECISIONS lines; SPEC §17's four backlog bullets retire
one by one as each ships.
