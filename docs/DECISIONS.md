# DECISIONS.md — Stitches decisions log

One line per decision: date · what · why. Append whenever a session deviates from
SPEC/DESIGN (per the PLAN.md session ritual).

- 2026-07-10 · Docs renamed to `docs/SPEC.md` / `DESIGN.md` / `PLAN.md` / `handoff.md` · match PLAN.md's binding references.
- 2026-07-10 · Node pinned 24.18.0 (nvm + `.nvmrc` + `engines`); dev machine had 26.0.0 · SPEC §5 says Node 24 LTS on dev and VPS.
- 2026-07-10 · **Version policy: pin to AI-known majors.** Scaffolded with `create-vite@7.1.3` → Vite 7.3.6, not current Vite 8 · AI assistance breaks on post-knowledge majors; deviates from SPEC §5 "current major" but stays inside its "7/8-era" note.
- 2026-07-10 · `@vitejs/plugin-react` held at 5.2.0 · 6.x peer-requires Vite ^8 only — never bump without deliberately moving to Vite 8.
- 2026-07-10 · TypeScript 5.9.3 (template shipped ~5.8.3; registry latest is 7.0.2) · SPEC pins 5.x; TS 7 (2-day-old Go rewrite) is peer-rejected by typescript-eslint (`<6.1.0`).
- 2026-07-10 · React Router 7.18.1, package `react-router` only · SPEC pins ^7; v8.2.0 (ESM-only, breaking) deferred per SPEC §16 #6.
- 2026-07-10 · ESLint 9.39.5 stack from the CV7 template + `eslint-config-prettier` · SPEC §12 "ESLint + Prettier defaults"; ESLint 10 is post-AI-knowledge.
- 2026-07-10 · `@types/node` pinned 24.13.3 · npm's `latest` tag tracks Node 26, not our pinned 24.
- 2026-07-10 · PocketBase v0.39.6 pinned in `scripts/dev.sh`; binary + `pb_data/` gitignored, downloaded on first `npm run dev`.
- 2026-07-10 · DESIGN §3 chip-contrast prose corrected with measured ratios (soft/deep 5.07–9.22:1, espresso-on-core 5.23–7.63:1) · the draft's "≈9:1" claim only holds for lilac; all pairs pass AA.
