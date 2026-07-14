# Session 2.2 — Counters (p07)

## Context

The flagship surface. Sessions 1.1–2.1 delivered the full schema (the `counters` collection, rules, and rules-check coverage already exist — `pb/` is NOT touched this session), pattern CRUD, attachments, and projects/journal. 2.2 builds: counter CRUD, the offline outbox (`lib/outbox.ts`, SPEC §11), realtime per open project, the full-screen `/projects/:id/count` surface (DESIGN §10), wake lock, dim mode, prefs groundwork, plus the ProjectCard progress bar deferred from 2.1 (DECISIONS 2026-07-13).

**After approval, step 0 is writing this plan to repo-root `PLAN.md`** (session ritual; archived to `logs/p07-session-2.2-counters-plan.md` once 📱 green).

## Settled with Zara (2026-07-13, this plan)

1. **ProjectCard progress bar** = oldest-created counter *with a target* (establishes the "primary counter" notion 2.3's home hero reuses).
2. **Pager** = the numeral zone swipes (horizontal scroll-snap, one page per counter, dots beneath); the strip is tap-to-switch chips.
3. **Reset** gets a **tiny confirm sheet** ("Reset {label} to 0?") — protects long counts from stray thumbs.
4. **Card ±** has identical semantics to the surface (+1 fires linked resets everywhere); the mint-star celebration stays exclusive to the surface.

## Architecture decisions (verified against installed deps)

**Overlay model, not literal cache mutation.** SPEC §11 says ops "apply to the TanStack cache instantly," but mutating the cache breaks under background refetch (staleTime 30 s), invalidation from meta-edits, and realtime echoes — pending taps would visibly revert. Instead: query cache holds **server truth only**; the outbox exposes pending ops via `useSyncExternalStore`; displayed value = `fold(ops for counter, over server value)` (`set` rebases, `inc` adds, clamp ≥ 0). Identical UX, immune to races. → DECISIONS line.

**SDK facts verified in `node_modules/pocketbase/dist/pocketbase.es.d.ts` (0.27.0):**
- `subscribe<T>(topic, cb, options?: RecordSubscribeOptions)` — options include `filter` (line 339–343, 693); options are re-sent on SDK reconnect. Per-project filtered subscription works: `pb.collection('counters').subscribe('*', handler, { filter: pb.filter('project = {:id}', { id }) })`.
- `requestKey?: string | null` (line 309): the SDK auto-cancels by default key `METHOD /path` — a CounterSheet meta-PATCH and a flusher PATCH to the same record would cancel each other. **Flusher requests pass `requestKey: null`.**
- Migration facts: `value` has `min: 0` and **no default** (PB 0.39 has no field defaults — create must send `value: 0` explicitly); update rule locks `project:changed`; `resets_with` is a single self-relation, cascadeDelete off; all rules owner-only.

**Outbox correctness holes, closed:**
- *Persistence:* `localStorage.setItem` synchronously inside the tap handler (key `stitches:outbox:v1`, shape `{ownerId, ops}`) — never debounced; survives app kill.
- *Coalescing:* tail-only merging never fires once linked resets interleave `set(B,0)` between incs. Use **per-counter compaction** (ops on different counters commute): new `inc` merges into the last queued op for that counter if it's an inc and not in-flight; new `set` deletes all prior non-in-flight ops for that counter. Queue stays ≤2 ops/counter regardless of offline duration; 10 airplane taps flush as one `{"value+": 10}`. Never mutate the in-flight head op. → DECISIONS line.
- *Multi-tab double flush:* wrap the flush loop in `navigator.locks.request('stitches:outbox', { ifAvailable: true }, …)` (iOS ≥15.4; module-boolean fallback if `navigator.locks` undefined); re-read the queue from localStorage at loop start and after every op; a `storage` listener reloads in-memory state (cross-tab display for free).
- *Flicker:* on flush success, write the PATCH response into the cache **then** remove the op, same synchronous block (React 19 batches both notifications — no numeral dip).
- *Error taxonomy:* `isAbort`/status 0 → stop, retry on next trigger · 401 → pause, resume on `authStore.onChange` valid · 400/403/404 → drop op, continue (≤1 toast per flush run). Queue tagged `ownerId`; mismatch on load → drop (cross-account guard); logout clears.
- *At-least-once:* accepted — the only double-apply window is response-lost-mid-flight (~100 ms slices); `set` is idempotent, the user sees the live value, −1/edit is the manual fix. A "sent" flag creates a resend-or-drop dilemma where drop loses taps (worse). → DECISIONS line.
- *Echo race:* one shared cache writer `applyServerCounter(record)` with a monotonic guard (skip if `incoming.updated < cached.updated`); both realtime handler and flusher route through it. Ops need no projectId — the PATCH response carries `.project` for cache routing.
- *StrictMode:* outbox listeners (`online`, `focus`, `visibilitychange`, authStore, 10 s tick while non-empty) live in the module, started once by `initOutbox()` from `main.tsx` — modules run once; effects double-invoke. Boot-flush therefore works even if no counter screen is ever opened. `visibilitychange` added to SPEC's trigger list (iOS fires it more reliably than `focus`). → DECISIONS line.
- *Layering wart:* `lib/outbox.ts` (SPEC-pinned path) imports `queryClient` + cache helpers from `features/counters/` — inverted but acyclic; comment it.

## Files

**New**
| Path | Contents |
|---|---|
| `web/src/lib/prefs.ts` | `stitches:prefs:v1` JSON blob `{counterDim, counterWakeLock, hapticTick}` (haptic key reserved for 2.3). `getPref`/`setPref`/`usePref` via `useSyncExternalStore` (cached snapshot — see auth.tsx loop-trap comment) + `storage` sync. |
| `web/src/lib/outbox.ts` | `CounterOp = {kind:'inc',counterId,n} \| {kind:'set',counterId,value}`; `initOutbox()`, `appendOps(ops[])` (atomic multi-op append: one tap = inc + linked sets in one persist+notify), compaction, `foldValue`, `pendingOps`/`subscribeOutbox`/`usePendingOps`/`useOutboxSyncing`, `dropOpsFor`, `clearOutbox`, flusher per above. inc → `update(id, {'value+': n}, {requestKey: null})`; set → `update(id, {value}, {requestKey: null})`. |
| `web/src/features/counters/queries.ts` | `counterKeys {all, forProject, mine}`; `useCounters(projectId)` (`getFullList`, `pb.filter('project = {:id}')`, `sort: 'created'`); `useMyCounters()` (viewer-wide, for /projects bars); `applyServerCounter` / `removeCounterFromCache` (monotonic guard). |
| `web/src/features/counters/mutations.ts` | `useCreateCounter` (sends `value: 0` explicitly), `useUpdateCounterMeta` (label/target/resets_with only — value never via mutations), `useDeleteCounter` (+ `dropOpsFor`, cache removal, invalidate). |
| `web/src/features/counters/realtime.ts` | `useCountersRealtime(projectId)`: cancelled-flag async cleanup (`.then(unsub => cancelled ? void unsub() : …)`), filtered subscribe, belt-and-braces `record.project === projectId` check, handler → cache helpers. Mounted on ProjectDetailPage AND CounterPage. |
| `web/src/features/counters/actions.ts` | `buildTapOps(counters, activeId, n)` → inc + `set(B,0)` per B with `resets_with === activeId` (increments only — resets/sets never chain, per SPEC); `crossesTarget(counter, displayedBefore, n)`. Shared by tap zone and card ±. |
| `web/src/features/counters/useWakeLock.ts` | `useWakeLock(enabled)`: request `'screen'` when enabled & visible; re-acquire on `visibilitychange`; release on cleanup; swallow rejections (reflect actual state); `wakeLockSupported` guard. |
| `web/src/features/counters/components/CountersCard.tsx` | Owner-only card at the ProjectDetailPage placeholder: rows (label · folded live value · small ± ≥44 pt via outbox · link glyph when `resets_with`), big "Open counter" → `/projects/:id/count`, stitch-border ghost "Add counter" row → CounterSheet. |
| `web/src/features/counters/components/CounterSheet.tsx` | Bottom sheet (FilterSheet draft-idiom, plain component state like EntryComposer — no RHF for 3 fields): label (required), target (optional, `inputmode="numeric"`, ≥16 px), `resets_with` select of same-project siblings excluding self ("On its own" empty option), delete inside (ConfirmDeleteDialog reuse). Create + edit modes; surface top-bar ✎ opens it for the active counter. |
| `web/src/features/counters/components/EditValueSheet.tsx` | Number input sheet → clamp int ≥0 → `set` op. |
| `web/src/features/counters/components/ResetConfirmSheet.tsx` | Zara's pick: tiny confirm ("Reset {label} to 0?") → `set(active, 0)`. |
| `web/src/features/counters/components/TargetStar.tsx` | One mint star pop (`STAR_PATH` import, `PATCH_SWATCHES.mint.core`), fired from the local tap handler (not an effect), `useReducedMotion`-gated. |
| `web/src/features/counters/components/SyncStitch.tsx` | Tiny X-stitch SVG (DESIGN §6 rules: 2.5–3 px round-cap strokes, token colors), CSS pulse (base.css reduced-motion kill covers it), shown while `useOutboxSyncing()`. |
| `web/src/routes/CounterPage.tsx` | The surface — layout below. |

**Edited**
- `web/src/lib/schema.ts` — `CounterRecord` (id, owner, project, label, value, target, resets_with, created, updated).
- `web/src/main.tsx` — route `{ path: '/projects/:id/count', element: <CounterPage /> }` (dockless sibling; static `count` segment outranks nothing here but sits with its family) + `initOutbox()` call.
- `web/src/routes/ProjectDetailPage.tsx` — CountersCard replaces the placeholder comment (line 203) + `useCountersRealtime(id)`.
- `web/src/features/projects/components/StarConfetti.tsx` — `export` the `STAR_PATH` const (no behavior change).
- `web/src/features/projects/components/ProjectCard.tsx` + `web/src/routes/ProjectsPage.tsx` — slim progress bar from `useMyCounters()`: oldest targeted counter per project (server values only — no overlay needed at list altitude).
- `docs/DECISIONS.md` — lines listed below.

## CounterPage layout (DESIGN §10, binding)

Root: `h-dvh` flex column, `overflow-hidden overscroll-none select-none`, `touch-action: manipulation` throughout, conditional `data-theme="stitchesdim"` from `usePref('counterDim')`, 250 ms color cross-fade via CSS transition (reduced-motion kill applies automatically). Dim numeral glow (soft blue `text-shadow`) and the 8 %-primary tap pulse via `color-mix(in srgb, var(--color-primary) 8%, transparent)` — tokens-only rule holds.

Top→bottom: **56 px bar** (back · project name · moon toggle · wake-lock toggle (hidden when unsupported) · ✎ edit) → **numeral pager** (scroll-snap horizontal; per page: label, numeral `clamp(5.5rem, 26dvh, 10.5rem)` Baloo 700 `tabular-nums`, slim progress bar + "12 of 48 rows" when target, linked captions "{A} +1 resets {B}" / "Resets with {A}") → **dots** → **strip** of other counters (chip: label + folded value, tap to switch) → **44 px row**: −1 (disabled at folded 0) · edit value · reset → **tap zone** `height: clamp(120px, 22dvh, 180px)` + `env(safe-area-inset-bottom)`, whole zone = +1.

- Active counter = validated `?c=` param (unknown/deleted → first by `created` asc; `setSearchParams(…, {replace: true})`); an effect scrolls the active page into view; a ref flag guards the scroll↔param feedback loop; `onScroll` + rAF derives the nearest snap index.
- a11y: one visually-hidden `aria-live="polite"` region announcing "{label}: {value}" (numerals inside duplicated snap pages confuse VoiceOver); explicit `aria-label` on every control.
- Feedback: numeral roll-pop = keyed `motion.span` on displayed value (fires for realtime changes too); pulse + TargetStar fire only from local tap handlers; star triggers on local inc crossing `< target → ≥ target` (re-fires after resets — correct for repeat trackers).
- Empty state (zero counters): message + "Add a counter" → CounterSheet.

## Build order (one session)

1. Data layer: `schema.ts` CounterRecord → counters `queries.ts`/`mutations.ts`; export `STAR_PATH`.
2. `lib/prefs.ts`.
3. `lib/outbox.ts` (the heart): store (load/persist/ownerId/`storage`) → compaction append → fold + hooks → flusher (locks, taxonomy, `requestKey: null`, write-then-remove) → triggers + `initOutbox()` in main.tsx.
4. `actions.ts`.
5. CountersCard + CounterSheet on ProjectDetailPage — proves outbox end-to-end with visible UI before the surface exists (DevTools offline → taps → reload → reconnect).
6. `realtime.ts` wired into the detail page; two-browser check.
7. CounterPage: route + shell → pager/strip/`?c=` → action row + EditValueSheet + ResetConfirmSheet → tap zone → feedback animations → SyncStitch.
8. Wake lock + dim + prefs wiring.
9. ProjectCard progress bar.
10. Acceptance pass + DECISIONS.md + session log (`logs/2026-07-13_session-2.2-counters.md`).

If time runs out: step 9 and pager-dot polish are the only safe trims — every acceptance box lives in 1–8.

## Microcopy (approved with this plan)

- Counters card empty: "Nothing counted yet — rows, repeats, anything worth keeping track of." · "Add counter"
- Surface empty: "Nothing to count yet — add one and keep your place." · "Add a counter"
- Captions: "{A} +1 resets {B}" (trigger side; "& {C}" for several) · "Resets with {A}" (target side)
- Sync stitch title/aria: "Syncing — your taps are saved"
- CounterSheet: label placeholder "Rows" · target helper "Optional — like 48" · resets_with label "Resets when another counter counts up", empty option "On its own" · delete confirm "Delete this counter? Its count goes with it."
- EditValueSheet: "Set {label}" · button "Set" · ResetConfirmSheet: "Reset {label} to 0?"
- a11y labels: "Plus one" / "Minus one" / "Reset to zero" / "Dim mode" / "Keep screen awake" / "Edit counter"

## DECISIONS.md lines to append

1. Outbox implements SPEC §11's "ops apply to the TanStack cache" as a pending-ops overlay folded over server-truth cache · identical UX, immune to refetch/realtime clobbering.
2. Per-counter compaction extends "coalescing consecutive incs" (a set deletes prior queued ops for its counter; incs merge) · linked resets interleave sets, so literal consecutive-only coalescing never fires; queue stays ≤2 ops/counter offline.
3. At-least-once flush accepted (response-lost window only; sets idempotent, incs user-visible) · idempotency keys don't exist in PB; a sent-flag forces resend-or-drop, and drop loses taps.
4. `visibilitychange` added to the flush triggers; flusher requests pass `requestKey: null` · iOS fires visibilitychange more reliably than focus; SDK auto-cancel (default key = METHOD+path) would let a meta-edit PATCH cancel a flusher PATCH.
5. Multi-tab double-flush guarded by Web Locks (`ifAvailable`) + re-read-inside-lock + `storage` listener · two tabs share the localStorage queue; `value+` would double-apply.
6. Reset button confirms ("Reset {label} to 0?"); card ± shares surface semantics (linked resets fire, star stays on surface); progress bar = oldest targeted counter; numeral zone is the swipe pager · Zara's picks with the p07 plan.
7. (If needed) microcopy lines above · approved with the p07 plan.

## Verification

- **Claude:** `npx tsc -b` (web) exit 0 · `npm run lint` clean. Grep installed `.d.ts` before using any uncertain API (lucide icon names; motion; Web Locks lib.dom types).
- **Zara (local, two browsers):** taps sync live both ways on one project; DevTools-offline tap burst → reload → reconnect → server lands on exact value; meta-edit while flushing (auto-cancel regression).
- **Zara 📱 via tailscale serve:** the four acceptance boxes — airplane-mode 10-tap kill/reopen/reconnect exact value · "Rows +1" zeroes linked stitches + target hit pops one mint star · wake lock survives tab-away-and-back · dim persists · no double-tap zoom anywhere.
- `pb/`, rules, seed untouched → `verify:rules` not required by the regression gate (re-run anyway if anything unexpected touches PB).
