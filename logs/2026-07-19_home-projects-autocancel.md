# 2026-07-19 — Home hero: "couldn't load" flash fixed; planned-vs-hook diagnosed

## What was done

Systematic debug of "projects show in the Projects tab but not on Home".
Two distinct causes found; one was a real defect and is fixed.

1. **Transient "Your projects couldn't load" (fixed).** The PocketBase SDK
   auto-cancels concurrent requests sharing a cancel key, and its default key is
   method+path only — query params excluded (verified in `pocketbase@0.27.0`
   dist source). Home mounts three `projects` list reads at once
   (`useProjects('in_progress')`, `useFinishedPatternIds()`, and the
   `useProjects(null)` any-projects probe), so after a create invalidates
   `projectKeys.all` (or on iOS refocus refetch) they cancel each other.
   React Query's `retry: 1` with its fixed ~1 s retry delay makes the two
   aborted queries retry simultaneously and collide again — two consecutive
   failures flips the hero into the error state; a later solo refetch succeeds
   and reverts it to the empty state. Fix: explicit `requestKey` derived from
   each query's logical identity on all three projects-path list hooks
   (`useProjects`, `useFinishedPatternIds`, `useLinkedProjects`) — the same
   opt-out pattern the counter outbox already uses (`outbox.ts:193`).
2. **"Nothing on the hook right now." despite existing projects (not a code
   defect).** The hero queries `status = 'in_progress'` only (SPEC: home =
   "on the hook right now"), while the create form defaults to
   `status: 'planned'` (SPEC §7 "default planned"). Both real projects in
   `pb_data` ("Yet", "Test 2") are `planned`, so the hero is correctly empty
   while `/projects` (all statuses, grouped) shows them. Any change here is a
   design decision — taken to Zara, not resolved by assumption.

## Files created/modified

- `web/src/features/projects/queries.ts` — `requestKey` on the three
  projects-collection list reads + explanatory comment.
- `scripts/verify/pb-autocancel.mjs` — new zero-network repro/proof script
  (stubbed fetch): default cancel key collides, distinct keys survive.
- `logs/2026-07-19_home-projects-autocancel.md` — this log.

## Decisions made

- Followed the existing per-request `requestKey` idiom instead of a global
  `pb.autoCancellation(false)`: counters realtime + outbox rely on tuned
  cancellation behavior, and the scoped fix leaves SDK protection intact.
- Patterns-collection hooks left untouched: no page currently mounts two
  patterns-path list queries concurrently (checked Home/Library/Friends/
  detail pages). Latent class noted here rather than pre-emptively patched.

## Open items

- Zara to verify on-phone: create a project, Home should no longer flash the
  error state. (`node scripts/verify/pb-autocancel.mjs` run green locally;
  lint + `tsc --noEmit` clean.)
- Zara to decide the planned-vs-hook UX: leave as designed / default new
  projects to `in_progress` / mention planned projects in the hero empty state
  / broaden the hero. SPEC + DECISIONS line needed if anything changes.

## Key file paths

`web/src/features/projects/queries.ts` · `web/src/routes/HomePage.tsx` ·
`scripts/verify/pb-autocancel.mjs` · `docs/DECISIONS.md:23` (no PB defaults)
