# CLAUDE.md — Stitches

Private, invite-only crochet pattern library + craft journal for a small friend group.
Mobile-first — iPhone Safari is the runtime. Cute is a requirement. Self-hosted on the
VPS in a late phase; until then everything is local.

## Read first, every session

1. `docs/PLAN.md` — build phases; execute exactly **one** session brief per sitting
2. `docs/SPEC.md` — architecture (**binding**)
3. `docs/DESIGN.md` — visual system (**binding**)
4. `docs/DECISIONS.md` — decisions log; append one line whenever a session deviates from SPEC/DESIGN
5. `docs/handoff.md` — original PRD (background)

State a short plan, then build. If anything is ambiguous or contradicts the docs,
**stop and ask Zara** — never resolve ambiguity by assuming.

## Who runs what — hard rule

Zara runs **all** state-changing commands herself: git writes, `npm install` / `npm create`,
downloads, `chmod`, `scripts/dev.sh`, deploys. Hand her complete, literal, copy-pasteable
commands (no heredocs, no placeholders, no `...`), then stop. Claude may: write/edit files,
run linters and pure verification scripts (`npm run lint`, `npm run verify:contrast`), and
do read-only inspection.

## Version policy — pin to AI-known majors

Exact pins only; `.npmrc` enforces `save-exact`. We deliberately stay on majors the AI
assistant actually knows: **Vite 7** (not 8), **ESLint 9** (not 10), **TypeScript 5.9**
(not 6/7), **React Router 7** (not 8; package `react-router` only, DOM APIs from
`react-router/dom`), **@vitejs/plugin-react 5.2.0** (6.x peer-requires Vite 8 — the trap).
Never bump a major "helpfully"; a real upgrade means reading migration notes first
(SPEC §16 #6) plus a `DECISIONS.md` line. PocketBase is pinned in `scripts/dev.sh`
(`v0.39.6` — post-dates AI knowledge; consult its docs rather than memory).

## Working agreements (SPEC §16, condensed)

- Dependencies over hand-rolling, always.
- Schema changes **only** via checked-in `pb/pb_migrations` files.
- Colors and fonts **only** via tokens in `web/src/styles/theme.css` — no hex in
  components, no backdrop blur, ever.
- Mobile-first at ~390 px; desktop is the adaptation. iOS hygiene checklist: DESIGN §12.
- Security lives in PocketBase API rules; client checks are UX sugar.
- Sessions end at their acceptance criteria, verified on a real iPhone via
  `tailscale serve` where marked 📱.

## Layout

`web/` Vite + React app · `importer/` Fastify sidecar (stub until Phase 3) ·
`pb/pb_migrations/` schema · `scripts/` dev.sh + verify/ · `docs/` binding docs

## Commands

```
npm run dev              # Zara runs: PocketBase :8090 + Vite :5173 (downloads PB binary on first run)
npm run lint             # Claude may run: eslint over web/
npm run verify:contrast  # Claude may run: WCAG AA gate over all token pairs
```

## Session Logging

After completing a plan or significant block of work, write a summary log to `logs/` as a markdown file named `YYYY-MM-DD_<short-description>.md`. The log should include:

- **Date** and brief title
- **What was done**: concise list of changes made, files created/modified
- **Decisions made**: any architectural or implementation decisions during the session
- **Open items**: anything deferred or left incomplete
- **Key file paths**: files created or significantly modified

This provides a persistent, reviewable trail of progress across sessions. Keep logs concise — aim for 40-60 lines max.
