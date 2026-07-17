# Session 4.2 — PWA, icon & polish — Plan

*Approved 2026-07-15. Archive to `logs/p12-session-4.2-pwa-polish-plan.md` once the phase walk is green.*

## Context

Phase 4's second sitting: make Stitches installable, fast, and finished-feeling (docs/PLAN.md §4.2), and clear every deferral that converged here — the DECISIONS 2026-07-13 KNOWN DEFERRED (JournalQuickSheet `revokePreview` leak), the 1.2-era sticky-bar/safe-area and search-ⓧ notes, the 1.3 same-path quick-add drop, the p04 AppHeader-greeting flag, and the ~1.13 MB single-chunk bundle.

Facts verified against installed code/registry (not memory) that shape the design:

- `vite-plugin-pwa` **1.2.0** (2025-11-27) is the newest AI-known release with `vite ^7` peer support; 1.3.0 (2026-05) is post-knowledge and held. `@vite-pwa/assets-generator` **1.0.2** (2025-10) same.
- PB SDK `getURL()` builds `/api/files/{collectionId||collectionName}/…` — **opaque collectionId wins** (verified in the installed `pocketbase.es.mjs`), so SW cache rules must never match on collection names. Every list/grid image carries `?thumb=`; every protected attachment fetch carries `?token=` (`protectedFiles.ts`). Query params are the reliable signals.
- Vite 7 `preview.proxy` / `preview.allowedHosts` default to the `server.*` values — `vite preview` works behind `tailscale serve` with zero config changes.
- React Router 7.18: route `lazy: () => import(...)` returning `{ Component }`; `ErrorBoundary` route field; previous route stays mounted while a lazy module loads (no flash).
- TipTap's eager seam is `HomePage → JournalQuickSheet → EntryComposer → NotesEditor` (4 import sites) — route splitting alone cannot evict TipTap from cold open; the seam must be the editor component.
- `JournalQuickSheet` unmounts `EntryComposer` on close (`{project && …}`) — an unmount-cleanup effect catches the backdrop-dismiss leak.
- Concept A's trailing thread, scaled to 512, ends ~310 px from center — outside the 204.8 px maskable safe zone (80 %). The master mark needs the thread curled in.
- daisyUI `.modal` already animates transform/opacity only; `.dock`'s layout is baked into `.dock > *` compound selectors (render a second nav variant, don't fight it).
- No `100vh` anywhere; base.css already covers tap-highlight, `touch-action`, focus ring, reduced-motion. Library/Projects sticky bars lack top safe-area. `SearchBar` uses `type="search"`.

## Decisions

- **Icon = concept A (yarn ball)** — Zara's pick this session; master SVG is full-square (no rounded corners: iOS composites transparency onto black; every OS applies its own mask), art inside the 80 % maskable safe zone.
- **Thumbnail cache gates on `?thumb=` / `?token=` params, not collection names** — PB file URLs use opaque collectionIds; token'd (protected) URLs are NetworkOnly and matched first.
- **Fonts are runtime-CacheFirst, excluded from precache** — @fontsource emits ~35 unicode-range subsets; precaching them all bloats SW install for glyphs never rendered.
- **TipTap splits at `LazyNotesEditor`** (component seam), routes split via RR7 `lazy` on dockless pages; Home/Library/Projects/Friends/Counter stay eager ("cold open → counting in one tap").
- **`/projects/:id` joins the lazy set** beyond the brief's literal list — HeroCard's Count button deep-links straight to `/count`, so detail isn't on the one-tap path.
- **Two `RouteErrorBoundary` mounts** (router root + inside AppShell children) so a tab-body crash keeps header/dock alive. Copy: "Dropped a stitch." / "Something went wrong loading this screen." / "Reload".
- **AppHeader goes route-aware** — greeting on Home only, compact lowercase title + avatar elsewhere (resolves the p04 flag; settings stay reachable behind the avatar everywhere).
- **Desktop dock = second plain-Tailwind markup variant at `lg:`**, not a CSS override of daisyUI's `.dock`.
- **`PatternFormPage` remounts via `key={location.key}`** — fixes the same-path quick-add drop; wiping half-typed fields on a fresh pick is correct semantics (a new file/link means starting over).
- **Manifest name/short_name lowercase "stitches"** (DECISIONS 2026-07-11 wordmark rule); `theme_color`/`background_color` `#FAF4E9` mirror `--color-base-200` (manifest/SVG are assets, not components).

## Files

| Path | Change | Why |
|---|---|---|
| `web/src/assets/icon.svg` | create | 512 full-square master, concept A mark transplanted from `stitches_app_icon_concepts.svg` via one affine transform, thread curled into safe zone |
| `web/pwa-assets.config.ts` | create | assets-generator preset (padding 0, no bg override) — emits the committed PNG set |
| `web/public/*.png`, `favicon.ico` | generated (Zara: `npm run icons`), committed | apple-touch 180, pwa 192/512, maskable 512 |
| `web/public/vite.svg` | delete | stock Vite favicon replaced |
| `web/vite.config.ts` | modify | add `VitePWA` block (manifest + workbox per Decisions) |
| `web/index.html` | modify | theme-color, apple-touch-icon, apple-mobile-web-app-title; drop vite.svg |
| `web/src/features/patterns/components/LazyNotesEditor.tsx` | create | `React.lazy` seam over existing `NotesEditor` (reuses its props/JSX untouched) |
| `NotesEditor.tsx` + 4 call sites (PatternForm, AttachmentsCard, EntryComposer, SummaryCard) | modify import line | swap to the lazy seam |
| `web/src/main.tsx` | modify | route `lazy` on dockless pages; `ErrorBoundary` mounts; eager set unchanged |
| `web/src/components/RouteErrorBoundary.tsx` | create | first error boundary in the app (reuses btn/ink-muted tokens) |
| `web/src/components/AppHeader.tsx` | modify | route-aware greeting/title variants |
| `web/src/components/AppShell.tsx` | modify | `lg:max-w-[1080px]` frame; `.dock-space` padding class |
| `web/src/components/Dock.tsx` | modify | `lg:hidden` on mobile dock + new desktop top-bar nav (same NavLinks/➕ handler) |
| `web/src/styles/base.css` | modify | `.dock-space`, search-ⓧ kill, button-press + toast micro-animations (uses the dormant `--dur-*`/`--ease-pop` tokens) |
| `web/src/routes/LibraryPage.tsx`, `ProjectsPage.tsx` | modify | sticky bars get `env(safe-area-inset-top)` (AppHeader/BackBar pattern) |
| `web/src/features/projects/components/EntryComposer.tsx` (+ other preview holders as found) | modify | unmount-cleanup revoking added-photo object URLs |
| `web/src/routes/PatternFormPage.tsx` | modify | `key={location.key}` remount wrapper |
| detail/form pages | modify | light `lg:max-w-3xl lg:mx-auto` centering |
| `web/package.json`, root `package.json` | modify | version 0.4.2; `icons`/`build`/`preview` scripts (root ones delegate `--workspace web`, matching `lint`) |
| `docs/DECISIONS.md` | append | one line per Decision above |
| `logs/2026-07-15_session-4.2-pwa-polish.md` | create | session log incl. the DESIGN §12 audit table |

## Steps

- [x] **0. Deps (Zara):** `npm install --save-dev --workspace web vite-plugin-pwa@1.2.0 @vite-pwa/assets-generator@1.0.2`
- [x] **1. Icon:** master SVG (`web/public/favicon.svg`, doubles as SVG favicon) + `pwa-assets.config.ts` + `icons` scripts — **pending Zara:** `npm run icons` + `git rm web/public/vite.svg`
- [x] **2. PWA:** `VitePWA` config landed exactly as specced (+ `globIgnores` for the pdfjs chunk); rules verified in built `dist/sw.js`
- [x] **3. Bundle seam A:** `LazyNotesEditor` + 4 import swaps → TipTap is its own 308 kB lazy chunk
- [x] **4. Bundle seam B:** route `lazy` set + `RouteErrorBoundary` ×2 (+ react/vendor `manualChunks`; main 1,126 kB → 395 kB, no size warning)
- [x] **5. AppHeader:** route-aware variants (greeting Home-only)
- [x] **6. Desktop pass:** AppShell 1080 px frame, Dock lg+ top-bar variant, dockless-page centering
- [x] **7. Deferred fixes:** 7a `useRevokeOnUnmount` in all four preview owners (StrictMode-safe deferred revoke) · 7b sticky-bar safe-area · 7c search-ⓧ kill · 7d `location.key` remount
- [x] **8. Micro-animations:** button press `scale(0.97)`, toast entrance keyed per message (base.css, tokens only)
- [x] **9. Housekeeping:** version 0.4.2; root `build`/`preview`/`icons` scripts — **pending Zara:** move the 4 board files to `docs/assets/`
- [x] **10. Verification (Claude side): lint clean · contrast 32/32 · build green, sw.js inspected — device walk is Zara's (below)**
- [x] **11. DECISIONS.md lines (13) + session log `logs/2026-07-15_session-4.2-pwa-polish.md`**

## Edge cases

- **Protected attachment ever fetched with `?thumb=`** — rule ① (`token=`) is matched first, so it still never caches.
- **SW update after deploy** — `registerType: 'autoUpdate'` + `cleanupOutdatedCaches`; split chunks mean small diffs re-download, not one 1.1 MB blob.
- **Lazy chunk fails to load offline** — chunks are precached (`**/*.js`), so lazy routes work offline once installed; a failed load on first-ever visit hits `RouteErrorBoundary` with Reload.
- **Render crash in a dock tab** — inner boundary keeps header + dock alive; navigation still possible.
- **Backdrop-dismiss with photos attached** — unmount cleanup fires regardless of dismissal path; double-revoke after Save is a silent no-op.
- **➕ pick while on `/patterns/new` with a half-typed form** — remount wipes it by design (new import = start over), identical to navigate-away-and-back.
- **Reduced motion** — new CSS animations are covered by the existing global kill in base.css; no JS motion added.
- **iOS `:active` on anchors unreliable** — card links deliberately excluded from the press effect until the device walk confirms behavior.

## Verification

1. **Claude:** `npm run lint` — clean.
2. **Claude:** `npm run verify:contrast` — all pairs still AA (no token changes; belt).
3. **Claude:** `npm run build` — main chunk shrinks materially vs 1,126 kB; new tiptap/route chunks; no chunk-size warning; then inspect `dist/sw.js` for the 4 runtime rules + denylist + no woff2 in the precache manifest.
4. **Zara (after step 0/1):**
   ```
   npm run dev
   ```
   second terminal:
   ```
   npm run build
   npm run preview
   tailscale serve --bg 4173
   ```
   On the iPhone over the ts.net URL: Add to Home Screen → icon looks right (PLAN box 3) → relaunch standalone → airplane mode → relaunch paints the shell (box 1) → DESIGN §12 walk incl. keyboard-vs-sticky-Save (box 2) → spot-checks: sticky bars below the notch when scrolled, single search-ⓧ, ➕ re-pick while on `/patterns/new` updates the form, desktop top bar ≥1024 px, settings footer "stitches v0.4.2".
5. docs/PLAN.md §4.2 boxes stay unticked until Zara confirms (batched-acceptance agreement). No pb_migrations/rules/seed touched → no `verify:rules` gate.

## Out of scope

Full offline browsing (Phase 5, deliberate) · Web Share Target (iOS Safari doesn't implement it) · multi-page scan grouping (backlog) · non-UTF-8 mojibake (revisit only if hit) · <1 s inc-refetch transient (accepted, p08) · PM2/deploy (5.1) · Ravelry (Phase 6) · feed pagination / tag dots (p11) · any major bumps (RR 8 / Vite 8 / TS 6+).
