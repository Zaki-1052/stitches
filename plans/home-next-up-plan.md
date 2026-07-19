# Home "Next up" fallback + Cast on — Plan

*Archived 2026-07-19 — shipped. Zara confirmed the next-up cards render on device; the Cast on
tap flow is code-verified only (interactive UI flows are not part of her device passes, her
call 2026-07-19). Previous working plan (Ravelry) archived to `plans/ravelry-plan.md`; debug
session that led here: `logs/2026-07-19_home-projects-autocancel.md`.*

## Context

Two causes sat behind "my projects don't show on Home": a real fetch bug (the PB SDK's
auto-cancel key is method+path only, so Home's three concurrent `projects` list reads cancelled
each other and flashed the hero error state — fixed this session with per-query `requestKey`s
in `web/src/features/projects/queries.ts`, proven by `scripts/verify/pb-autocancel.mjs`) and a
design gap: the hero shows only `in_progress`, while the create form defaults to `planned`, so
a default-configuration project never appears on Home and it reads as a bug. Outcome: hero
prefers WIPs; with no WIPs but planned projects, Home shows them as "Next up" cards with a
one-tap **Cast on** action; empty states only when neither exists. Casting on becomes a small
deliberate moment instead of a form default.

## Decisions

- Fallback hero, not a broader hero query · "on the hook" keeps meaning in-progress; planned
  surfaces only when it's the most relevant thing (Zara, 2026-07-19).
- Create form keeps `planned` as default · SPEC §7 intact; the fix is visibility, not defaults.
- Planned cards render from the existing `useProjects(null)` probe · data already fetched when
  the hero settles empty; no new query.
- Cast on = `useQuickUpdateProject` with `{ status: 'in_progress' }`, no date side-effects ·
  DECISIONS 2026-07-13: status flips never touch `started_on`.
- Microcopy (whimsical, no em-dashes): header "next up" · subline "waiting to be cast on" ·
  button "Cast on" · success toast "On the hook ♡" · error toast "Cast on slipped a stitch,
  try again?" · Zara may reword at review.

## Files

| Path | Change | Why |
|---|---|---|
| `web/src/features/home/components/NextUpCard.tsx` | create | planned-project card; reuses HeroCard's cover/name/pattern anatomy, `StatusChip` (display-only), `YarnBall`, `pb.files.getURL` |
| `web/src/routes/HomePage.tsx` | modify §heroSection | next-up branch + cast-on handler; reuses the `anyProjectsQuery` probe data, `useQuickUpdateProject`, `useToast`, `normalizeStatus`, the hero snap-scroll wrapper |
| `docs/DECISIONS.md` | append 2 lines | (a) Next up fallback + Cast on; (b) PB auto-cancel gotcha → per-query `requestKey`s |
| `docs/SPEC.md` (route list, ~315) | modify 1 line | home gains the next-up planned fallback |
| `docs/DESIGN.md` (§9 Home, ~216) | modify 1 sentence | document the fallback + Cast on in the binding visual spec |

## Steps

- [x] Archive Ravelry plan → `plans/ravelry-plan.md`; this plan takes over root `PLAN.md`
- [x] `NextUpCard.tsx`: cover-or-YarnBall + name + pattern as one Link, planned `StatusChip`,
      full-width primary Cast on button (`disabled` while the flip is pending, per-project
      aria-label)
- [x] `HomePage.tsx`: derive `planned` from the probe (filter `normalizeStatus === 'planned'`),
      cast-on handler (quick update + toasts), insert `else if (planned.length > 0)` branch
      between the pending-probe skeleton and `isNewUser` (single card in `px-5`, several in the
      hero snap-scroll wrapper), update the p08 state-matrix comment
- [x] Docs: DECISIONS ×2, SPEC route line, DESIGN §9 sentence
- [x] Verification 1–3 (Claude), session log to `logs/`
- [x] 📱 Zara's end-of-work acceptance *(2026-07-19: cards render on device, "loads the cards
      and everything". The Cast on tap flow was not device-tested — interactive flows aren't
      part of Zara's passes; it is covered by lint/types and the detail page's identical
      status-flip path)*

## Edge cases

- Several planned projects → same snap-scroll carousel as multi-WIP heroes, `-updated` order.
- Legacy record with empty `status` → `normalizeStatus` reads it as planned → appears in
  Next up (matches `status.ts`'s documented display rule).
- Cast on fails (PB down, offline) → error toast, card stays put, button re-enables — failure
  stays legible, nothing silently degrades.
- Double-tap / second card tapped mid-flight → all Cast on buttons share the `pending` flag.
- Flip settles → invalidation refetches the in-progress list and the probe concurrently — safe
  now only because of this session's `requestKey` fix; RQ keeps previous data during refetch so
  no ghost-card flash between states.
- Probe errors → chain falls through to the ghost card exactly as today (no misclassification).
- Projects that are all finished/frogged/hibernating (none planned, none in progress) → ghost
  card "Nothing on the hook right now.", unchanged.

## Verification

1. **Lint (Claude ran, clean):** `npm run lint`.
2. **Types (Claude ran, exit 0):** `cd web && npx tsc --noEmit -p tsconfig.app.json`.
3. **Auto-cancel regression (Claude ran, green):** `node scripts/verify/pb-autocancel.mjs` →
   "reproduced: default key cancels concurrent same-collection reads; distinct keys fix it".
4. **📱 Device pass (Zara, 2026-07-19):** next-up cards render on Home with the planned chip ✓.
   Cast on tap flow + post-create error-flash absence: not device-tested (see Steps note).
