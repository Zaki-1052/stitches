# Phase 6 Add-ons, Part 1 — Yarn Stash + Offline (Sessions 6.1–6.3 as one session)

## Context

Cece approved four add-ons; `docs/ADDONS.md` (binding) specs them. Phase 5 (VPS) is unbuilt, so
share links (6.4) and the clipper (6.5) wait — this session builds everything genuinely useful
now: **6.1 yarn stash → 6.2 offline foundations → 6.3 vault keep-on-phone**, executed as one
continuous session (Zara's call, 2026-07-20), staged in ADDONS' build order. Zero Phase 6 code
exists yet (the `addons` commit was docs-only).

At session end this file archives to `plans/p14-sessions-6.1-6.3-addons-plan.md` and the root
copy is removed (home-next-up precedent). `docs/PLAN.md` acceptance boxes stay unticked until
Zara confirms.

**Who runs what:** Claude writes all files and runs `npm run lint` + `npx tsc -b --noEmit` +
read-only inspection. Zara runs: `npm install`, `npm run verify:fresh`, `npm run dev`, git.
There are exactly **two Zara gates** mid-session (marked ⛔) plus the final walk.

## Deviations & flags (approved with this plan; each gets a DECISIONS/log line where noted)

1. **`seed.mjs` seeds no projects today** — ADDONS §2.4 wants a yarn "linked to an existing seed
   project", so the seed gains one minimal project per demo user (linked to one of their seeded
   patterns). Small scope addition; veto if unwanted.
2. **"Used in" query lives in `features/projects/queries.ts`**, not under `yarnKeys` as ADDONS
   §2.3's sketch shows — it reads the `projects` collection, and the shipped convention is that
   every projects read hangs off the single `['projects']` root (invalidation correctness;
   `useLinkedProjects` precedent). DECISIONS line.
3. **Offline mutation UX** — ADDONS §3.5 says "pre-flight-checks `useOnlineStatus()` … (via the
   shared PB-error normalizer, new offline branch)". Implemented as the normalizer branch only:
   the installed SDK already fails fast offline (`ClientResponseError{status:0,isAbort:false}`,
   verified against pocketbase@0.27.0), so one branch in `normalizePbError()` covers every
   existing mutation with zero per-form edits. The hook drives only the header indicator.
   DECISIONS line.
4. **"Sync didn't finish. Try again?"** is listed under ADDONS §3.6 but is a sync-failure
   message — it surfaces in 6.2's OfflineCard, not the vault.
5. **No grid/list view toggle for `/yarn`** — ADDONS' file tree has none; single grid. Log note.
6. **`ConfirmDeleteDialog`** (generic, in `features/projects/components/`) is reused for the yarn
   delete and Clear-all-kept confirms rather than duplicating the dialog shell.
7. **`YarnForm.tsx`** isn't in ADDONS §2.3's component sketch but is required by PLAN 6.1's build
   bullet ("list/detail/form") — sketch gap, filled.
8. **Link-guard fixture #5 added** beyond ADDONS' four: B creates a project mixing an own yarn
   with A's *private* yarn → must be denied. It's the single assertion that catches per-aggregate
   OR grouping (the actual attack), and is the decisive full-rule vs fallback discriminator.

## Microcopy (approved with the p14 plan; no em-dashes in new copy)

- Stash empty: **"No yarn yet. Your basket is ready when you are."** + CTA **"Add your first yarn"**
- Search empty: reuse existing approved *"Nothing matches, yet — try loosening a filter."* verbatim (keeps its dash)
- Used-in empty: **"Not in a project yet."**
- Yarn delete confirm: **"Delete this yarn? Projects that used it keep their story. The yarn leaves your stash."**
- Yarn visibility helper: **"Friends can see this yarn in your stash. Only you can change it."**
- Offline indicator: **"Offline. Showing what's saved."**
- Offline save failure: **"You're offline. Try again once you're back online."**
- Sync failure: **"Sync didn't finish. Try again?"**
- Keep toggle: **"Keep on this phone"** · kept badge: **"On this phone"**
- Kept caption: **"Saved for offline reading. iOS may clear it if space runs very low."**
- Un-kept offline View: **"This file needs the internet. Keep it on this phone to read it offline."**
- Keep failure toast: **"Couldn't keep that file. Try again?"**
- Clear-all confirm: **"Remove kept files from this phone? They stay safe in your vault."**

## Global constraints

- Schema only via `pb_migrations`; security in PB rules; colors/fonts only via `theme.css` tokens.
- Migrations: module-local helpers redeclared, string `+` concatenation (no template literals), no schema-level defaults (PB 0.39.6).
- Every new list query gets an explicit `requestKey: key.join(':')` (DECISIONS 2026-07-19).
- DESIGN §12 iOS hygiene on all new UI: ≥44pt targets, ≥16px inputs, safe-area padding, in-app back affordance, `dvh` only.
- Exact dep pins (`.npmrc` save-exact). Verified via `npm view`: persist-client/persister **5.101.2** (peer `^5.101.2` = installed core), **idb-keyval 6.3.0** (still 6.x). Re-check `.d.ts` shapes after install (they're not on disk yet).
- ADDONS §7 closure this session: #1–4 empirically via rules-check (Gate 1); #5 defensive + honest copy; #6 flip-ready constant, decided at device walk; #7 assumed non-viable, no action; #8 the `npm view` pins above.

---

## Stage 0 — Prep

**0.1** Modify `web/package.json`: add `"@tanstack/react-query-persist-client": "5.101.2"`,
`"@tanstack/query-async-storage-persister": "5.101.2"`, `"idb-keyval": "6.3.0"`; bump `version`
to `"6.3.0"` (phase.session convention, combined session — feeds `__APP_VERSION__` buster).

⛔ **Zara Gate 0:** `npm install` (from repo root). Paste any warnings.
*(Stage A doesn't need the deps — she can run this whenever before Stage B.)*

## Stage A — Yarn stash (6.1)

**A1 — Migration.** Create `pb/pb_migrations/<unix-ts>_yarn_stash.js` (ts > 1784446344), Session
1.1 idioms (redeclare `AUTHED/OWNER/OWNER_LOCK/IMAGE_MIMES/IMAGE_THUMBS/MB/ownedFields()`).

- **Phase 1 — `yarns`:** fields per ADDONS §2.1 — `name` (text, required), `brand`/`colorway`/
  `fiber` (text), `weight` (select, byte-identical 9-value `cyc_0…cyc_8` array copied literally
  from `patterns.yarn_weight`), `yardage_per_skein` (number), `skein_count` (number, `min: 0`),
  `photos` (file, `maxSelect: 6`, `maxSize: 8*MB`, IMAGE_MIMES, IMAGE_THUMBS), `notes` (editor),
  `visibility` (select private·friends, no default). Index: `CREATE INDEX idx_yarns_owner ON yarns (owner)`.
  Rules: list/view `AUTHED && (OWNER || visibility = "friends")` · create `OWNER` ·
  update `OWNER && OWNER_LOCK` · **delete `OWNER`** (quiet unlink — no back-relation guard; DECISIONS line).
- **Phase 2 — edit `projects` in place** (`findCollectionByNameOrId` + `fields.add(new
  RelationField({name:'yarns', collectionId: yarns.id, maxSelect: 99, cascadeDelete: false}))` +
  save — the `counters.resets_with` idiom), then append to the existing rules:
  ```js
  const YARN_LINKABLE =
    '(yarns = "" || yarns.owner = @request.auth.id || yarns.visibility = "friends")'
  const YARN_LINKABLE_UPDATE =
    '(@request.body.yarns:changed = false || @request.body.yarns = "" ||' +
    ' @request.body.yarns.owner = @request.auth.id ||' +
    ' @request.body.yarns.visibility = "friends")'
  projects.createRule = projects.createRule + ' && ' + YARN_LINKABLE
  projects.updateRule = projects.updateRule + ' && ' + YARN_LINKABLE_UPDATE
  ```
- **Down-migration:** `projects.fields.removeByName('yarns')`, **restore createRule/updateRule by
  hardcoding the Session-1.1 strings verbatim** (PB stores resolved strings — you can't subtract
  clauses; copy from `1783819397`), then delete `yarns`. Code comment explains this.

**A2 — rules-check, extended in place** (`scripts/rules-check.mjs`):
- `yarns` joins the anon-empty sweep loop, `sweep()` (no pre-unlink needed), and the final
  leftover tuple array (`['yarns','name']`).
- Fixtures: `yarnPrivA`, `yarnSharedA`, `yarnB` (all `[rules-check]`-marked).
- New `· yarns` matrix section — the `· patterns` block with the collection swapped (~9 assertions).
- New `· projects ↔ yarns link guard` section (verify-at-build #1–4), decision rule as a comment:

| # | Fixture | Expected | Proves |
|---|---|---|---|
| 1 | A creates project, `yarns: []` | Ok | #3 empty-array vacuous pass |
| 2 | A creates project, `yarns: [privA, sharedA]` (two own) | Ok | baseline |
| 3 | B creates project, `yarns: [yarnB, sharedA]` (legit mix) | Ok | #2 per-row OR doesn't misdeny |
| 4 | B creates project, `yarns: [privA]` | Denied | #1 bare-operator denial |
| 5 | B creates project, `yarns: [yarnB, privA]` (illegit mix) | **Denied** | the wall: per-aggregate grouping check |
| 6 | B updates own project adding `privA` | Denied | #4 `@request.body` dot-join |
| 7 | B updates own project to `[yarnB, sharedA]`, then unlinks | Ok | #4 happy path |

- **Cascade unlink proof** (phase 3): A creates yarn Y + project P with `yarns:[Y]` → delete Y
  succeeds while linked → re-fetch P → assert `!P.yarns.includes(Y.id)` and P still exists.
- **Decision rule:** all pass as expected → full rule ships (already in A1), DECISIONS line
  records #1–4 verified. Fixture 5 or 6 unexpectedly *succeeds* → real wall: edit A1's constants
  to drop the `visibility` arm, flip `FULL_RULE_SHIPPED = false` (A5), DECISIONS line, re-gate.
  A "should-pass" fixture *failing* → different bug (likely filter syntax) — diagnose from
  `describeError` output, don't auto-fallback.

**A3 — Seed** (`scripts/seed.mjs`, `ensureRecord` idiom): one project per demo user (linked to
one of their seeded patterns, `status:'planned'`); 2–3 yarns each (weights spread, ≥1 private +
≥1 friends); idempotent follow-up `update(projectId, {yarns:[yarnId]})` linking one.

⛔ **Zara Gate 1:** `npm run verify:fresh 2>&1 | tee logs/verify-fresh-6.1.txt` — expect ALL
GREEN ×2 including `· yarns`, `· projects ↔ yarns link guard`, cascade proof. Paste output;
Claude applies the decision rule before continuing.

**A4 — `web/src/lib/schema.ts`:** `YarnRecord` (fields per A1; `weight: YarnWeight | ''`,
`visibility: Visibility | ''`, `expand?: {owner?: UserRecord}`), `yarnFormSchema` /
`yarnFormDefaults` / `yarnToFormValues` (numberString idiom for the two number fields),
`ProjectRecord.yarns: string[]` + `expand.yarns?: YarnRecord[]`, `projectFormSchema.yarns:
z.array(z.string())` with default `[]`. `YARN_WEIGHTS`/`cyc.ts` reused untouched.

**A5 — `web/src/features/yarn/`:**
- `queries.ts`: `yarnKeys` factory (`all/lists/list(viewerId,filters)/options(viewerId)/details/detail(id)`
  — **no `usedIn`**, see flag 2); `useYarns(filters)` (own stash: `owner = viewer` + q/weight,
  mirror `usePatterns`), `useYarn(id)`, `useYarnOptions()` (picker candidates:
  `FULL_RULE_SHIPPED ? (own || friends) : own` — module const, lockstep with A1/A2 outcome,
  comment says so). All list queries carry `requestKey`.
- `mutations.ts`: `useCreateYarn/useUpdateYarn/useDeleteYarn` (patterns mirror; invalidate
  `yarnKeys.lists()`/`detail`).
- `formData.ts`: `buildYarnFormData(values, photos, mode, ownerId)` — patterns' photos/photos+/
  photos- idiom, no thumbnail field.
- `urlParams.ts`: `YarnFilters {q, weight[]}`, `EMPTY_YARN_FILTERS`, parse/serialize/count (trimmed
  patterns mirror).
- `components/`: `YarnCard` (grid card, `photos[0]` ?thumb=400x0 or YarnBall placeholder — raw
  `pb.files.getURL` for now, `thumbUrl()` doesn't exist until Stage B); `YarnEmptyState`
  (kind library|search, approved copy); `YarnFilterSheet` (draft-state dialog, weight group only);
  `YarnChip` (neutral pill: base-100 fill, base-300 border, round `?thumb=100x100` swatch,
  "{brand} · {name}", tap → `/yarn/:id` — deliberately not patch-colored, DESIGN §3 addition);
  `YarnForm` (PatternForm mirror minus tags/source: name/brand/colorway/weight select/fiber/
  yardage+skein pair/PhotosField max 6/LazyNotesEditor/visibility/SaveBar);
  `YarnUsedInList` (presentational: `{projects: ProjectLinkRecord[]}` → StatusChip rows);
  `YarnPicker` (**TagPicker toggle-chip idiom**, not the native single select: candidates from
  `useYarnOptions()`, swatch+label chips, ghost "+ add yarn" pill → `/yarn/new`, no inline create).

**A6 — Routes & nav:**
- Create `routes/YarnListPage.tsx` (LibraryPage mirror: LibraryTabs + sticky search +
  YarnFilterSheet + grid + "+ Add yarn" → `/yarn/new`), `YarnDetailPage.tsx` (PatternDetailPage
  mirror: hero, meta chips via `CYC_LABELS`, notes (dompurify), photos, used-in section fed by
  `useProjectsLinkedToYarn`, VisibilityToggle + approved helper, SharedByChip for non-owners,
  delete via ConfirmDeleteDialog + approved copy), `YarnFormPage.tsx` (PatternFormPage shell:
  BackBar, `key={location.key}` remount).
- `main.tsx`: `{path: 'yarn', element: <YarnListPage/>}` eager beside `patterns`; `/yarn/new`
  (before `/yarn/:id`), `/yarn/:id`, `/yarn/:id/edit` lazy.
- Create `components/LibraryTabs.tsx`: two NavLink pills (Patterns · Yarn), own `isActive` per
  pill; mounted atop LibraryPage + YarnListPage (each keeps independent URL filter state free).
- `components/Dock.tsx`: `useLocation()`; Library slot gets bespoke active state
  `pathname.startsWith('/patterns') || pathname.startsWith('/yarn')`, always `to="/patterns"`;
  other slots untouched; both phone + desktop variants.
- `components/AppHeader.tsx`: `PAGE_TITLES['/yarn'] = 'library'`.

**A7 — Project integration:**
- `ProjectForm.tsx`: `Controller name="yarns"` → `<YarnPicker/>` near the freeform "yarn used"
  text field (which stays). `projects/formData.ts`: tags-style multi append (`[]` → one empty
  append; else append each id).
- `ProjectDetailPage.tsx`: yarn-chips section (render `expand.yarns` when non-empty);
  `useProject` expand becomes `'pattern,owner,yarns'`.
- `projects/queries.ts`: `projectKeys.linkedToYarn(yarnId)` + `useProjectsLinkedToYarn(yarnId)` —
  `filter: yarns.id ?= {:id}`, `fields: 'id,pattern,status,name'`, requestKey.

**A8 — Claude verification:** `npm run lint` + `npx tsc -b --noEmit` green; code-walk the
interaction flows (add→link→chip→tap-through; delete→project untouched) since Zara's walk is
load/look only.

## Stage B — Offline foundations (6.2)

**B1** Create `lib/network.ts`: `useOnlineStatus()` via `useSyncExternalStore` over
`navigator.onLine` + online/offline listeners.

**B2** Modify `features/shared/errors.ts`: after the non-ClientResponseError early-return,
```ts
if (err.status === 0 && !err.isAbort) return { status: 0, message: OFFLINE_MESSAGE, fieldErrors: {} }
```
(`OFFLINE_MESSAGE` = approved copy). Covers every mutation; counters/outbox untouched (own
`isRetryable`). DECISIONS line (flag 3).

**B3** Extract shared fetch functions so sync and hooks share one implementation (no
shape-drift): `fetchPatternsForSync(viewerId)` (`expand:'tags,owner'`),
`fetchProjectsForSync(viewerId)` (`expand:'pattern,owner,yarns'`),
`fetchAllJournalEntriesForSync(viewerId)` (one unfiltered sweep, sort `-entry_date,-created`),
`fetchMyCounters`, `fetchFriendsFeed`, `fetchTags`, `fetchYarnsForSync(viewerId)`
(`expand:'owner'`) — exported from their existing per-feature `queries.ts` files.

**B4** Create `lib/sync.ts` (outbox mold: module init, `stitches:sync:v1` localStorage
`{ownerId, lastSyncedAt}`, owner-mismatch discard, `useSyncExternalStore`):
- API: `initSync()` (main.tsx, beside `initOutbox()`), `triggerSync({force?})`,
  `useSyncStatus(): {lastSyncedAt, inProgress, error}`, `SYNC_MIN_INTERVAL_MS = 10*60*1000`
  (gates the `online` trigger only; boot + "Sync now" pass force).
- `runSync(viewerId)`: fetch each canonical unfiltered list into its **exact runtime queryKey**
  (`patternKeys.list(viewerId, EMPTY_FILTERS)`, `projectKeys.list(viewerId, null)`,
  `tagKeys.list`, `yarnKeys.list(viewerId, EMPTY_YARN_FILTERS)`, counters mine, friends feed) via
  `queryClient.fetchQuery`; seed every detail cache (`setQueryData(xKeys.detail(id), row)`);
  group the journal sweep by `entry.project` into `entryKeys.forProject(projectId)`; also seed
  detail caches from friends-feed rows if the feed returns full records (check shape at build).
  Key precision is load-bearing: keys must structurally match the hooks' defaults or offline
  browse silently misses. Partial failure: keep what landed, set error to approved sync copy.
  DECISIONS line for the v1 filtered-search limit.

**B5** Modify `lib/auth.tsx` — the boot fix (ADDONS §3.1):
- Context gains `unverified: boolean`. Named `refresh()`:
  definitive rejection (`ClientResponseError && status >= 400 && !isAbort`) → `authStore.clear()`;
  network failure/abort → keep session, `setUnverified(true)`. Success →
  `setUnverified(false)` + `triggerSync({force:true})`.
- Retry `refresh()` on `online` + `visibilitychange→visible` **only while unverified** (ref-gated).
- `ProtectedRoute` deliberately unchanged (`unverified` must not redirect — that's the un-brick).
- SDK discrimination verified: raw network TypeError → `ClientResponseError{status:0,isAbort:false}`.

**B6** Create `features/shared/persistence.ts` + modify `main.tsx`: use
**`PersistQueryClientProvider`** (replaces `QueryClientProvider`; gates queries until restore —
avoids the async-restore race) with `createAsyncStoragePersister` over an idb-keyval `createStore
('stitches-query-cache','cache')` (distinct DB from kept-files), `buster: __APP_VERSION__`,
`maxAge: 30d`, `dehydrateOptions.shouldDehydrateQuery: (q) => defaultShouldDehydrateQuery(q) &&
q.queryKey[0] !== 'fileToken'` (keeps success-only default AND excludes the credential). Mutation
cache stays unpersisted. Verify exact exported names against the installed `.d.ts` post-install.

**B7** Create `lib/files.ts`: `thumbUrl(record, filename, context: 'chip'|'grid'|'hero')` →
sizes `100x100 / 400x0 / 800x0`. **Re-grep `pb.files.getURL` at execution** (Stage A added
sites); refactor all thumb-bearing call sites (~14 pre-existing + new yarn ones) onto it. Leave
alone: originals (`EntryCard:37`, `PatternDetailPage` lightbox), `ProfileCard` avatar preview
(2026-07-14 deliberate exception), token-gated `protectedFiles.ts`.

**B8** `sync.ts` warming step: after lists land, fire-and-forget `fetch()` the exact `thumbUrl`
strings the cards will request (grid size per collection card, chip for avatars) via
`Promise.allSettled` — SW CacheFirst matches exact URLs, comment says so.

**B9** `vite.config.ts`: thumbnails `maxEntries: 300 → 2000`. DECISIONS line (estimate()
sanity-check deferred to device walk).

**B10** Create `features/settings/components/OfflineCard.tsx` (settings-card shell): "Last
synced {formatRelativeTime(lastSyncedAt) | 'never'}", **Sync now** button (`triggerSync({force:
true})`, disabled while `inProgress`), error line. Mount in `SettingsPage.tsx` before Log out.
Add `formatRelativeTime(iso)` to `lib/dates.ts` (hand-rolled, no dep).

**B11** `AppHeader.tsx`: `offline = !useOnlineStatus() || unverified` → small `CloudOff`
(verified in lucide 1.24.0) + approved indicator copy under the title. Counter stitch untouched.

**B12 — Claude verification:** lint + tsc green (post-install).

## Stage C — Vault keep-on-phone (6.3)

**C1** Create `lib/keptFiles.ts` — idb-keyval `createStore('stitches-kept-files','files')`
(separate DB from B6's), key `` `${ownerId}:${attachmentId}:${filename}` ``:
`initKeptFiles()` (main.tsx; `pb.authStore.onChange` sweep drops keys not prefixed by the current
owner — covers logout + identity change), `useKeptFileIds(): ReadonlySet<string>`,
`useKeptFilesSummary(): {count, totalBytes}` (sum `blob.size` via `entries()`),
`keepFile(owner, id, filename, blob)` (first call: feature-detected one-shot
`navigator.storage.persist()`, module-flag guarded), `unkeepFile`, `unkeepAllForAttachment`,
`clearAllKept`, `getKeptBlob`. Create `lib/bytes.ts`: `formatBytes(n)`.

**C2** Create `features/patterns/useKeptAttachments.ts`:
`useKeptAttachments(records): Record<key, objectUrl>` — mint object URLs for kept keys, reuse
existing, revoke immediately on un-keep; `useRevokeOnUnmount` catches final unmount.

**C3** Modify `AttachmentsCard.tsx`: per-file "Keep on this phone" toggle (VisibilityToggle
styling) + "On this phone" badge + `formatBytes` size + kept caption. On enable: one-shot
`pb.files.getToken()` (NOT the 60s `useFileToken` query) → `fetch(protectedFileUrl(...))` →
`res.ok` check → `keepFile(...)`; failure → approved toast, toggle stays off. View stays a
synchronous `<a href>`: kept object URL first, else token URL; un-kept + offline → approved
explainer text instead of a dead link. `handleDelete` additionally calls
`unkeepAllForAttachment(user.id, id)` (call-site, keeps `attachmentMutations.ts` pure).

**C4** `OfflineCard.tsx`: "{count} files kept · {formatBytes(totalBytes)}" row (when count > 0) +
**Clear all kept files** via ConfirmDeleteDialog + approved copy → `clearAllKept()`.

**C5** `blob:` PDF decision path: ship `KEPT_PDF_VIEW_MODE: 'link' | 'pdfjs' = 'link'` const; if
the 📱 walk shows iOS mishandling blob PDFs, flip it and build `KeptPdfViewer.tsx` on the
existing `pdfThumbnail.ts` worker-loading idiom (self-hosted worker, stacked canvases). DECISIONS
line either way at the walk.

**C6 — Claude verification:** lint + tsc; code-walk keep→view→unkeep→delete→logout-sweep flows.

## Stage D — Docs & close

**D1** Doc edits landing with the session that makes them true (ADDONS §8):
- SPEC §5 (three new deps), §7 (`yarns` collection + rules + `projects.yarns`), §11 (offline
  architecture replaces "Full offline stays in Phase 5"), §12 (routes `/yarn*`, sync/persistence
  state note), §17 (retire "full offline browsing" + "yarn stash" bullets).
- DESIGN §3 (yarn chip: neutral pill, photo swatch, why not patch-colored), §8 (LibraryTabs,
  OfflineCard, keep-toggle), §9 (Library segmented tabs, yarn screens, offline indicator).
**D2** Append DECISIONS.md lines (dated at build): quiet-unlink delete semantics · link-guard
outcome (#1–4 verified, or fallback) · used-in placement (flag 2) · offline-normalizer
interpretation (flag 3) · sync v1 filtered-search limit · thumbnails 300→2000 · dep pins ·
p14 microcopy batch ("approved with the p14 plan").
**D3** Session log `logs/2026-07-20_sessions-6.1-6.3-yarn-offline.md`; archive plan to
`plans/p14-sessions-6.1-6.3-addons-plan.md`, remove root `PLAN.md`. `docs/PLAN.md` boxes untouched.

⛔ **Zara Gate 2 (close):**
1. `npm run verify:fresh 2>&1 | tee logs/verify-fresh-6.3.txt` — ALL GREEN ×2 (regression gate:
   this session touched migrations + rules + seed).
2. `npm run dev` → load/look pass: `/yarn` tabs + empty state, a seeded yarn card/detail, project
   detail chips, Settings OfflineCard, DevTools offline-checkbox reload shows the header
   indicator. Interaction flows are already code-verified — nothing scripted for her.
3. 📱 items batch at the phase-boundary walk (airplane-mode cold reopen; never-visited pattern
   offline after Sync now; kept-PDF in airplane mode; blob-PDF behavior → C5 flip decision;
   storage.estimate() sanity check).

## Verification summary

| Who | What | When |
|---|---|---|
| Claude | `npm run lint`, `npx tsc -b --noEmit`, code-walk of every interaction flow | end of each stage |
| Zara | `npm install` | Gate 0 (before Stage B) |
| Zara | `verify:fresh` + paste (link-guard decision) | Gate 1 (after A3) |
| Zara | `verify:fresh` + dev load/look pass | Gate 2 (close) |
| Zara | 📱 device walk (all deferred items) | phase boundary |
