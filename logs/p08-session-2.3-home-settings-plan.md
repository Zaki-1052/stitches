# Session 2.3 — Home & settings

## Context

Sessions 0.1–2.2 built the shell, auth, the full library (CRUD + attachments), projects + journal, and the counter surface with its offline outbox and prefs groundwork. Two stubs remain: `HomePage.tsx` and `SettingsStub.tsx`. Session 2.3 replaces both so the app "earns a home-screen spot" (PLAN §2.3). Acceptance: 📱 cold open → counting on the active project in one tap; change-password works end to end (no SMTP — this is the only self-service reset path).

**Zara's picks (made during planning → DECISIONS.md lines):**
1. **Haptic tick** = the iOS 17.4+ hidden `<input type="checkbox" switch>` hack wired into CounterPage's tap handlers, gated by the existing `hapticTick` pref. (SPEC §1: no Vibration API on iOS — this native-switch side effect is the only thing that works on Cece's iPhone; hence "experimental", default off.)
2. **Hero Journal button** opens `EntryComposer` in a bottom sheet on home (true quick entry), not a navigation.
3. **Doors row** ships **two** doors (Add a file · Type it in), matching the dock ➕ sheet; Paste-a-link joins in 3.2.

No migrations, no new npm dependencies, no schema/rules/seed changes → the `verify:rules` regression gate is not triggered.

**Verified facts (installed sources, not memory):**
- pocketbase 0.27.0 `RecordService.update()` merges the response into `authStore` when updating the current auth record → profile saves propagate to `AppHeader` via `lib/auth.tsx`'s onChange mirror, zero extra code.
- Password change (`update(id, {oldPassword, password, passwordConfirm})`) rotates the token key server-side → must re-auth with `authWithPassword(email, newPassword)`.
- `queryClient` has global `staleTime: 30_000` → a real staleness hole for home hero values (fix in §3).
- `tsconfig.node.json` (type-checks `vite.config.ts` under `tsc -b`) lacks `resolveJsonModule`.
- `users.avatar` has no declared thumb sizes (only library collections got them) → render the original, like AppHeader already does; post-pipeline files are small.

---

## 1. File list

**New**
| Path | Purpose |
|---|---|
| `web/src/routes/SettingsPage.tsx` | Real settings screen; replaces the stub |
| `web/src/features/settings/components/ProfileCard.tsx` | Name + avatar edit (avatar through `processImage`) |
| `web/src/features/settings/components/PasswordCard.tsx` | Change password with the re-auth sequence |
| `web/src/features/settings/components/CounterPrefsCard.tsx` | Three toggles over `usePref`/`setPref` |
| `web/src/features/home/components/HeroCard.tsx` | Big "on the hook" card: cover, name, pattern, live counter value + progress, Count + Journal |
| `web/src/features/home/components/DoorsRow.tsx` | 2-up quick-add doors (comment slot for 3.2's link door) |
| `web/src/features/home/components/RecentPatternsStrip.tsx` | "recently added" horizontal strip of `PatternCard` |
| `web/src/features/home/components/HomeEmptyState.tsx` | New-user empty state: illustration + "start your library" |
| `web/src/features/home/components/JournalQuickSheet.tsx` | `modal-bottom` dialog hosting `EntryComposer` |
| `web/src/components/YarnBasket.tsx` | New illustration, drawn this session per DESIGN §6 |
| `web/src/features/patterns/useAddFileDoor.ts` | Extraction of QuickAddSheet's `handleFile` + `titleFromFilename` (shared by sheet + home) |
| `web/src/features/counters/haptics.tsx` | `useHapticTick()` — hidden native switch + `tick()` |

**Modified:** `web/src/main.tsx` (route `SettingsPage`) · `web/src/routes/HomePage.tsx` (full rewrite) · `web/src/routes/CounterPage.tsx` (tick in tap handlers) · `web/src/features/patterns/components/QuickAddSheet.tsx` (refactor onto `useAddFileDoor`; behavior-identical, keeps inline errors — dialog top layer covers toasts) · `web/src/features/patterns/queries.ts` (`useRecentPatterns`) · `web/src/features/counters/queries.ts` (mine-cache mirror, §3) · `web/vite.config.ts` + `web/tsconfig.node.json` + `web/src/vite-env.d.ts` + `web/package.json` (version, §5) · `docs/DECISIONS.md` · new `logs/` session log.
**Deleted:** `web/src/routes/SettingsStub.tsx`.

New `features/home/` + `features/settings/` folders extend SPEC §6's feature list → one DECISIONS line.

## 2. Home (`HomePage.tsx` rewrite)

`AppShell` already renders `AppHeader` (greeting + avatar → `/settings`) — home renders only content below it.

- **Hero section**: `useProjects('in_progress')` (`-updated` → card #1 is the active project; `expand: pattern` feeds the pattern line and the composer). One project → single full-width `HeroCard`; multiple → snap row (`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-px-5`, hidden scrollbar via the CounterPage arbitrary-selector idiom, cards `w-[86%] shrink-0 snap-center` so the next peeks). No URL sync. Pending → skeleton; error → gentle retry (ProjectsPage idioms).
- **HeroCard** (`--shadow-lift` per DESIGN §5 "active hero"): cover `?thumb=800x0` / YarnBall placeholder + name + pattern line wrapped in one `Link` → `/projects/:id`; live counter block (label + folded value, Baloo tabular-nums; progress bar + "12 of 48 rows" when the counter has a target; muted hint when the project has no counters — no invented zero); action row: big `btn-primary` **Count** `Link` → `/projects/:id/count?c=<primaryId>` (plain `/count` when no counters — the surface shows its own empty state) + tonal **Journal** button. No nested interactives; everything ≥44 pt.
- **Live value** = `foldValue(counter.value, counter.id, pending)` with `usePendingOps()` once at page level — never raw `counter.value`. **Selection**: primary = oldest with `target > 0` (the ProjectsPage:81-87 rule), fallback oldest counter, else none — built once in a `useMemo` map from `useMyCounters()`.
- **JournalQuickSheet**: `<dialog class="modal modal-bottom">` (EditValueSheet open/close idiom) hosting `EntryComposer` (`project` from the hero; `onDone`/`onCancel` close; the composer already handles pipeline/mutation/"Entry saved ♡" toast). Page state: `journalFor: ProjectRecord | null`.
- **DoorsRow**: 2-col grid of tonal door buttons (blue-soft "Add a file" / mint-soft "Type it in", QuickAddSheet's palette + captions), driven by `useAddFileDoor` — the extraction keeps navigation + `setPendingAttachmentImport` inside the hook and returns `{busy, error, inputRef, onInputChange}`; each surface renders its own hidden file input so the picker opens from the button's own gesture. Errors inline under the row (parity with the sheet).
- **RecentPatternsStrip**: new `useRecentPatterns(8)` (`getList(1, 8, {filter: owner, sort: '-created', expand: 'tags'})`, keyed under `patternKeys.lists()` so existing invalidations catch it) + existing `useFinishedPatternIds()` for made ✓; `w-36 shrink-0` wrappers around `PatternCard view="grid"` in an `overflow-x-auto` row; header + "see all" → `/patterns`. Hidden when no patterns.
- **State matrix** (never decided while queries are pending — no empty-state flash):

| in-progress | any content | Render |
|---|---|---|
| ≥1 | — | hero(s) + doors + strip |
| 0 | none at all | `HomeEmptyState` (YarnBasket + "start your library") + doors as the CTA |
| 0 | some | partial-empty card ("Nothing on the hook right now." + Start a project → `/projects/new`) + doors + strip |

  The "any content" fact comes from a conditional `useProjects(null)` enabled only once in-progress settles empty (same key ProjectsPage's unfiltered view populates) plus the patterns strip query.
- **YarnBasket** (DESIGN §6, binding): chubby round basket (flat `--patch-butter` body, `--patch-butter-soft` rim), two yarn balls (`--color-primary`, `--patch-coral`) with short winding strokes, a crochet hook leaning out, 2–3 butter/mint stars; all strokes `var(--color-base-content)` 3 px round caps/joins; no gradients/blur; ~120–140 px; `aria-hidden`.
- **No realtime subscription on home** (SPEC §11 scopes realtime to the open project).

## 3. Counter-cache staleness fix (`features/counters/queries.ts`)

Global `staleTime: 30_000` means: count on the surface → back to home within 30 s → `useMyCounters` serves pre-tap values after pending ops have flushed and drained → hero shows the old value. Fix: extend the existing server-truth funnel —
- `applyServerCounter(record)` upserts into **both** `counterKeys.forProject(record.project)` and `counterKeys.mine(record.owner)` (same monotonic-`updated` guard + created-asc insert via one shared helper).
- `removeCounterFromCache({id, project, owner?})` mirrors removal in `mine`; `owner` falls back to `pb.authStore.record?.id` so `useDeleteCounter`'s existing call site compiles unchanged.

Flush responses, realtime echoes, and meta-edits then keep home live with zero home-specific plumbing; the fold covers the in-flight window. (Known pre-existing transient: a refetch racing an in-flight inc can double-display for <1 s — identical to the surface today.)

## 4. Settings (`SettingsPage.tsx`, dockless: `min-h-dvh bg-base-200` + `BackBar`)

1. **ProfileCard** — 96 px round avatar preview (initials placeholder per AppHeader; original file, no `?thumb=`) with change (hidden `input accept="image/*"` → mandatory `processImage()` → preview swap) and remove ("×", ThumbnailField's `unchanged | new | removed` state); name input (RHF + zod, trimmed min 1, 16 px). Save: FormData `{name, avatar: File}` when new file; `{name, avatar: null}` when removed; `{name}` otherwise → `pb.collection('users').update(user.id, body)`. Header updates itself (verified SDK sync). Toast "Saved ♡".
2. **PasswordCard** — RHF + zod: current (min 1) · new (min 8, PB default) · confirm (refine match); `autocomplete="current-password"`/`"new-password"`; 16 px inputs. Sequence:
   1. `const email = pb.authStore.record?.email` — guard first: missing → toast "Please log in again to change your password." + `authStore.clear()`.
   2. `update(user.id, {oldPassword, password, passwordConfirm})` — old token is now dead server-side.
   3. `authWithPassword(email, newPassword)` — fresh token, app stays signed in.
   4. Reset form, toast "Password changed ♡".
   Failures: step 2 400 `oldPassword` → inline "That doesn't match your current password." (other field errors inline via the errors helper; non-field → toast; nothing changed, user stays signed in). Step 3 fails (network gap) → password IS changed, token dead → `authStore.clear()` + toast "Password changed — log in with your new one." — never keep a dead token (every request would 401 confusingly). The outbox listener sees the same user id, so the queue survives re-auth.
3. **CounterPrefsCard** — three daisyUI toggle rows (whole row is the `<label>`, ≥44 pt), instant `setPref`, no save button: wake-lock default (`counterWakeLock`) · dim memory (`counterDim`) · haptic tick (`hapticTick`, default off, "experimental" caption).
4. **Sign out** — existing `pb.authStore.clear()` button unchanged.
5. **Version footer** — "stitches v{`__APP_VERSION__`} · made with ♡" (xs, ink-muted).

## 5. Haptic tick + version plumbing

- **`features/counters/haptics.tsx`**: `useHapticTick()` → `{element, tick}`. `element` = visually hidden checkbox (1 px, absolute, `aria-hidden`, `pointer-events-none` — **not** `display:none`, iOS skips fully hidden switches); the non-standard `switch` attribute set via ref callback `el.setAttribute('switch','')` (React 19 JSX types don't know it). `tick()` = `el.click()` **synchronously inside the tap gesture** — iOS 17.4+ Safari plays the system haptic on native switch toggles; silent no-op elsewhere. CounterPage: call `tick()` in the +1 zone and −1 handlers when `usePref('hapticTick')` — not on programmatic resets; independent of `prefers-reduced-motion` (opt-in, not motion). Honest code comment + caption; on-device proof deferred to the phase walk 📱.
- **Version**: `web/package.json` → `0.2.3` (phase.session). `vite.config.ts`: `import pkg from './package.json'` + `define: {__APP_VERSION__: JSON.stringify(pkg.version)}`; add `"resolveJsonModule": true` to `tsconfig.node.json`; `declare const __APP_VERSION__: string` in `vite-env.d.ts`.

## 6. Edge cases & iOS hygiene

Stale `?c=` on the Count link is safe (CounterPage validates, falls back to oldest) · single project renders without a snap container (no sideways scroll) · unchanged avatar never sends the field (no clobber) · HEIC converts via pipeline, undecodable → inline error · empty states gated on every relevant `isPending` · strip tiles fall back to YarnBall placeholders. Hygiene: all new inputs ≥16 px; every control ≥44 pt; `dvh` only; snap rows `overscroll-x-contain`; BackBar stays on settings; 📱 keyboard-vs-sheet and keyboard-vs-password-save tests at the phase walk.

## 7. New microcopy (approve with this plan → DECISIONS lines)

- Partial-empty card: **"Nothing on the hook right now."** + **"Start a project"** (echoes, doesn't duplicate, the projects-list line).
- New-user: headline **"Start your library"** + sub **"Save a pattern you love — the hook comes later."**
- Hero no-counter hint: **"No counters yet — the Count button will set one up."**
- Section headers: **"add a pattern"** (sheet's header verbatim) · **"recently added"** · **"see all"**.
- Profile: **"Saved ♡"** · **"Please enter a name."**
- Password: **"That doesn't match your current password."** · **"At least 8 characters."** · **"These don't match yet."** · **"Password changed ♡"** · **"Password changed — log in with your new one."**
- Prefs captions: **"Keep the screen awake while counting."** · **"Remember moonlight mode on the counter."** · **"A tiny tick with every tap. Experimental — newer iPhones only."**
- Footer: **"stitches v0.2.3 · made with ♡"**.

**DECISIONS.md lines (dated 2026-07-13):** haptic tick = hidden-switch hack (why "experimental") · hero Journal = composer sheet on home · doors row ships two doors until 3.2 · hero counter = primary-with-target falling back to oldest · `applyServerCounter`/`removeCounterFromCache` mirror into the `mine` cache (staleTime hole) · `features/home/` + `features/settings/` folders extend SPEC §6 · version via Vite define, `web/package.json` = 0.2.3 · microcopy batch.

## 8. Build order (each step leaves lint/tsc green)

1. Version plumbing (§5) — verify with `npx tsc -b` + `npm run build`.
2. SettingsPage shell — route swap, delete stub, BackBar + sign out + version footer.
3. CounterPrefsCard → 4. ProfileCard → 5. PasswordCard (§4 sequence, all failure paths).
6. Counters funnel mine-cache mirror (§3) — existing call sites compile unchanged.
7. `useAddFileDoor` extraction + QuickAddSheet refactor (behavioral no-op).
8. `useRecentPatterns` → 9. YarnBasket illustration → 10. HomePage rewrite (hero/doors/strip/states) → 11. JournalQuickSheet → 12. Haptic tick + CounterPage wiring.
13. Docs: DECISIONS lines, session log `logs/2026-07-13_session-2.3-home-settings.md`, archive this plan to `logs/p08-session-2.3-home-settings-plan.md`.

## 9. Verification

- **Claude runs:** `npm run lint` · `npx tsc -b` · `npm run build`. Verify against installed sources while implementing: `authStore.record.email` present after refresh; the `switch` ref approach compiles; pipeline output size vs the 5 MB avatar cap.
- **Zara tests (dev, then 📱 at the phase walk):** change-password end to end (wrong old → inline error + still signed in; success → app keeps working; sign out → old password fails, new works) · name/avatar save updates the header live; remove restores initials · count 5 on the surface → back to home → hero shows the new value (staleness-fix proof); airplane-mode taps show folded values on home · snap row pages with peek; single card doesn't scroll · empty matrix (fresh user → illustration; content-but-no-WIP → partial card) · home "Add a file" PDF → pre-filled form; dock ➕ sheet unchanged · Journal from hero → entry lands in the feed · prefs drive the counter surface on next open.
- **📱 deferred to the phase walk** (batched-acceptance agreement): both PLAN §2.3 boxes (cold-open one-tap; on-phone password change), haptic tick on a real iPhone, keyboard-vs-sheet checks. Boxes stay unticked until Zara confirms.
