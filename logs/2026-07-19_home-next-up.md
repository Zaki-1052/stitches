# 2026-07-19 — Home "next up" fallback + Cast on

## What was done

Implemented the approved PLAN.md (root): when nothing is in progress but planned
projects exist, the Home hero area now shows them as "next up" cards with a
one-tap **Cast on** action instead of the "Nothing on the hook right now."
ghost card. Follows the same-day debug session
(`logs/2026-07-19_home-projects-autocancel.md`) that found the planned-vs-hook
design gap.

- `web/src/features/home/components/NextUpCard.tsx` (new): HeroCard's
  cover/name/pattern anatomy + display-only lilac `StatusChip` + full-width
  Cast on button (`disabled` while a flip is pending, per-project aria-label).
  No counter block, no Journal.
- `web/src/routes/HomePage.tsx`: `planned` derived from the existing
  any-projects probe (`normalizeStatus === 'planned'`, no new query);
  `else if (planned.length > 0)` branch between the pending-probe skeleton and
  `isNewUser` (single card / hero snap-scroll carousel, lowercase "next up"
  header matching the recently-added strip); cast-on handler via
  `useQuickUpdateProject` with `{ status: 'in_progress' }` (no date
  side-effects, DECISIONS 2026-07-13); state-matrix header comment updated.
- Docs: two DECISIONS.md lines (PB auto-cancel gotcha + requestKey fix; next-up
  fallback + microcopy), SPEC.md route line, DESIGN.md §9 Home paragraph.
- Root `PLAN.md` swapped: Ravelry plan archived verbatim to
  `plans/ravelry-plan.md` (R3 boxes parked there); this feature's plan is now
  the root working plan.

## Decisions made

- All decisions were locked in the approved plan; no deviations during
  implementation. Microcopy as planned: "next up" / "waiting to be cast on" /
  "Cast on" / "On the hook ♡" / "Cast on slipped a stitch, try again?".

## Verification

- Claude ran: `npm run lint` clean · `tsc --noEmit -p web/tsconfig.app.json`
  exit 0 · `node scripts/verify/pb-autocancel.mjs` green.
- No pb_migrations / API rules / seed changes, so no verify:rules rerun.

## Open items

- None. Zara confirmed 2026-07-19 that the next-up cards render on device; the
  Cast on tap flow is code-verified only (interactive UI flows aren't part of
  her device passes — her call, saved to memory). Plan archived to
  `plans/home-next-up-plan.md`; root `PLAN.md` removed.

## Key file paths

`web/src/features/home/components/NextUpCard.tsx` ·
`web/src/routes/HomePage.tsx` · `docs/DECISIONS.md` · `docs/SPEC.md` ·
`docs/DESIGN.md` · `PLAN.md` · `plans/ravelry-plan.md`
