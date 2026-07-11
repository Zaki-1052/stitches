# Stitches — Session 0.1: Scaffold & Theme — Plan

*Live copy of the approved plan (2026-07-10). Checkboxes track real state. The project build
plan lives at `docs/PLAN.md`; this file is the session plan.*

## Context

This session executes **docs/PLAN.md Phase 0, Session 0.1**: an npm-workspaces skeleton with
Vite + React 19 + TS strict + Tailwind 4 + daisyUI 5, the DESIGN §2 theme verbatim, self-hosted
fonts, a `/tokens` demo route proving both themes, `scripts/dev.sh` that downloads PocketBase and
boots PB + Vite together, an AA contrast gate, and the root `CLAUDE.md` + `docs/DECISIONS.md`
every future session reads. Fully local; the VPS is not touched.

**Version strategy (governs everything):** pin to majors the AI assistant actually knows — not
the newest thing the registry serves. Vite 8, ESLint 10, TS 7, and React Router 8 all shipped
after the assistant's knowledge; building on them means unassisted debugging of breaking changes.
So the scaffold itself is pinned (`create-vite@7.1.3`) and every dependency is an exact pin from
the Vite 7 / ESLint 9 / TS 5.9 era. All versions verified against the registry on 2026-07-10.

**Division of labor:** Zara runs every state-changing command (git, npm create/install, chmod,
npm run dev) — handed to her complete and literal. Claude writes/edits files and runs only lint +
the pure contrast script.

## Decisions

- **Scope: Session 0.1 only** — one session brief per sitting, per docs/PLAN.md.
- **Docs renamed** to `docs/SPEC.md` / `DESIGN.md` / `PLAN.md` / `handoff.md`. *(done)*
- **Node 24 LTS (24.18.0)** via nvm, `.nvmrc` + `engines`. *(done)*
- **Pin to AI-known majors; pin the scaffold itself** — `create-vite@7.1.3`, whose template still
  ships ESLint 9 flat config (no oxlint). Deviation from SPEC §5 "current major" logged in
  DECISIONS.md; SPEC's own "7/8-era" note and vite-plugin-pwa 1.3 both bless Vite 7.
- **`@vitejs/plugin-react` must be `5.2.0`, never 6.x** — 6.x peer-requires `vite ^8.0.0` only.
- **TypeScript `5.9.3`** — SPEC pins 5.x; TS 7 is peer-rejected by typescript-eslint (`<6.1.0`).
- **React Router `7.18.1`, only `react-router`** (DOM APIs from `react-router/dom`); v8 deferred.
- **Lint stack at the template's era**: eslint `9.39.5`, @eslint/js `9.39.5`, typescript-eslint
  `8.63.0`, react-hooks `5.2.0`, react-refresh `0.4.20`, globals `16.4.0`, + eslint-config-prettier
  `10.1.8` appended last.
- **`@types/node` pinned `24.13.3`** — `latest` tracks Node 26.
- **PocketBase `v0.39.6`** per SPEC; `--dir`/`--migrationsDir` confirmed; binary gitignored,
  downloaded by dev.sh.
- **`importer/` is a stub workspace** (zero deps); Fastify arrives Session 3.1.
- **`.npmrc` `save-exact=true`** — every future install exact-pins automatically.
- **theme.css byte-for-byte from DESIGN §2** — validity confirmed for tailwindcss 4.3.2 /
  daisyui 5.6.16. No "improvements".
- **If any contrast pair fails AA: stop and ask** — tokens are binding DESIGN values.

### Pinned versions (exact, verified 2026-07-10)

| | |
|---|---|
| **scaffold:** create-vite `7.1.3` | **lint:** eslint `9.39.5` · @eslint/js `9.39.5` · typescript-eslint `8.63.0` |
| vite `7.3.6` (final 7.x) · @vitejs/plugin-react `5.2.0` | eslint-plugin-react-hooks `5.2.0` · eslint-plugin-react-refresh `0.4.20` |
| react / react-dom `19.2.7` · typescript `5.9.3` | globals `16.4.0` · eslint-config-prettier `10.1.8` · prettier `3.9.5` |
| tailwindcss / @tailwindcss/vite `4.3.2` · daisyui `5.6.16` | @types/react `19.2.17` · @types/react-dom `19.2.3` · @types/node `24.13.3` |
| react-router `7.18.1` · @fontsource baloo-2 & nunito `5.2.7` | PocketBase binary `v0.39.6` · Node `24.18.0` · (later: vite-plugin-pwa `1.3.0`) |

## Steps

### Phase A — Housekeeping ✅ (docs renamed, `git init`, Node 24.18.0 via nvm)

### Phase B — Scaffold ✅
- [x] 1. Root `PLAN.md`, `.nvmrc`, `.npmrc`, `.gitignore`
- [x] 2. `npm create vite@7.1.3 web -- --template react-ts` *(Zara ran it; template verified as the CV7 file set)*
- [x] 3. Root `package.json` (workspaces), `importer/package.json` stub, `pb/pb_migrations/README.md`

### Phase C — Theme & app ✅
- [x] 4. `web/package.json` → exact pins per table (plugin-react held at 5.2.0)
- [x] 5. `theme.css` verbatim · `vite.config.ts` (react + tailwind plugins, proxy `/api` `/_` → 8090,
      `/import` → 8095, `allowedHosts: ['.ts.net']`) · `index.html` viewport (`viewport-fit=cover`) +
      title · `main.tsx` (fonts + router) · `App.tsx` (Outlet shell) · `routes/TokensPage.tsx` ·
      template boilerplate deleted (tsconfigs already had explicit `"strict": true` — no edit needed)
- [x] 6. `eslint.config.js` + eslint-config-prettier appended · root `.prettierrc`

### Phase D — Scripts & docs
- [x] 7. `scripts/dev.sh` · `scripts/verify/contrast.mjs` · root `CLAUDE.md` · `docs/DECISIONS.md`
- [x] 8. **Zara ran** cleanup of the pre-workspaces nested install + one root `npm install` — clean
- [x] 9. **Zara ran:** `chmod +x scripts/dev.sh`

### Phase E — Verify & commit
- [x] 10. Claude ran: lint exit 0 · contrast 32/32 PASS (tightest: ink-muted/base-300 4.81:1) ·
      hex-grep zero hits · `npm ls` resolves exactly 7.3.6 / 5.2.0 / 9.39.5 / 5.9.3 · `tsc -b` exit 0
- [ ] 11. **Zara runs** `npm run dev 2>&1 | tee dev-boot.txt`, eyeballs `http://localhost:5173/tokens`
- [ ] 12. **Zara runs:** `git add -A && git commit -m "Session 0.1: scaffold (vite 7 era, pinned), theme tokens, /tokens demo, dev script"`
      — paste the contrast output into the commit body per the acceptance criterion

## Edge cases

- **Deterministic scaffold** — create-vite@7.1.3 is a fixed tag; scaffolded files matched the
  verified CV7 file set (ships `eslint.config.js`, no oxlint).
- **The plugin-react 6.x trap** — guarded by exact pins, `save-exact=true`, and the rule in
  `CLAUDE.md` + `DECISIONS.md`.
- **Nested lockfile** — `web/node_modules` + `web/package-lock.json` exist from a pre-workspaces
  install; step 8 removes them so the root lockfile is the only one.
- **PB zip contents** — dev.sh extracts only the binary; `pb/*.zip` gitignored; curl'd binaries
  don't get macOS quarantine.
- **Port collisions (8090/5173)** — `set -euo pipefail`; PB fails loudly; no silent fallbacks.
- **Contrast failure** — report ratios, stop, ask; DESIGN tokens don't change unilaterally.
- **`/_` proxy breadth** — catches all `/_*`; Vite internals live under `/@vite`, no overlap.
- **First PB boot** — creates `pb_data/` (gitignored); superuser setup is Session 0.2.

## Verification

1. **Claude:** `npm run lint --workspace web` → exit 0, no warnings *(after step 8)*.
2. **Claude:** `node scripts/verify/contrast.mjs` → every pair PASS, exit 0; output → commit body.
3. **Claude:** `grep -rn "#[0-9A-Fa-f]\{6\}" web/src --include="*.tsx" --include="*.ts"` → zero hits.
4. **Claude:** `npm ls vite @vitejs/plugin-react eslint typescript --workspace web` → exactly
   7.3.6 / 5.2.0 / 9.39.5 / 5.9.3 *(after step 8)*.
5. **Zara:** `npm run dev 2>&1 | tee dev-boot.txt` → PB downloads, `Server started at
   http://127.0.0.1:8090`, Vite on 5173.
6. **Zara (browser):** `http://localhost:5173/tokens` → cream `stitches` swatches/chips/buttons;
   `stitchesdim` panel renders navy; fonts visibly Baloo 2 / Nunito.
7. **Zara:** `curl -s http://localhost:5173/api/health` → PocketBase JSON through the Vite proxy.
8. **Acceptance (docs/PLAN.md Session 0.1):** dev boots both ✓ (5–6) · AA contrast noted in
   commit ✓ (2, 12) · exact pins + lint clean + CLAUDE.md/DECISIONS.md exist ✓ (1, 4, 3–7).
