# Session 0.2 — Auth & App Shell  *(reviewed + verified; execution-ready)*

## Context

PLAN.md Session 0.2 turns the themed scaffold from 0.1 into a real, gated app: log in on an
iPhone, land in a themed shell with a dock. Session 0.1 delivered the workspace, the token/theme
system (`web/src/styles/theme.css`), fonts, `scripts/dev.sh` (PB v0.39.6 :8090 + Vite with
`/api` `/_` `/import` proxy), React Router 7 in `main.tsx`, and a throwaway `/tokens` route.
Nothing auth-related exists yet; `pb/pb_migrations/` is empty; there is **no root README**.

This session adds: the first PB migration (the `users` auth collection — its locked `createRule`
*is* the invite gate), PB SDK singleton + `authRefresh` boot, login screen with hand-drawn
yarn-ball mark, protected-route wrapper, app shell (header + avatar, 4-slot dock with raised ➕,
back affordance), `scripts/seed.mjs` (two demo users), and a fresh README. Fully local — VPS
untouched. Security = PB API rules; client checks are UX sugar (SPEC §15/§16).

## Decisions locked

- **Wordmark:** lowercase **`stitches`**, Baloo 2 700 (DESIGN §14 wins over §9) → one line in
  `docs/DECISIONS.md`.
- **Login form:** react-hook-form + zod established now (SPEC §5).
- **Seed credentials:** everything via env vars; nothing hardcoded.
- **TanStack Query:** deferred to 1.1 (auth state lives in `pb.authStore`).
- **README:** created fresh at repo root.

## ✅ Dependencies — DONE (Zara ran the install; verified in web/package.json + root node_modules)

`pocketbase` **0.27.0** · `lucide-react` **1.24.0** · `react-hook-form` **7.81.0** · `zod`
**4.4.3** · `@hookform/resolvers` **5.4.0** — all exact pins, hoisted to root `node_modules`
(so `scripts/seed.mjs` resolves `pocketbase` too). No further installs needed.

## ✅ Verified API facts — checked against the actual installed artifacts (do NOT re-derive; cite this)

**Resolvers ↔ zod 4:** `@hookform/resolvers/zod` peer-accepts `zod ^3.25.0 || ^4.0.0` → zod
4.4.3 ✓. Import `{ zodResolver } from '@hookform/resolvers/zod'`.

**PB v0.39.6 fresh bootstrap** (read from the local `pb/pb_data/data.db`, which was created by
0.39.6 with zero user migrations — authoritative fresh-install state):
- Collections already present: `users` (auth), `_superusers`, `_mfas`, `_otps`, `_externalAuths`,
  `_authOrigins`. → **The migration EDITS `users` in place; it never creates it.**
- `users` defaults (needed for the `down` revert): `listRule`/`viewRule`/`updateRule`/`deleteRule`
  = `id = @request.auth.id`; `createRule` = `""` (empty string = **open signup** — must lock!);
  `authToken.duration` = **432000**; `oauth2.enabled`=false, `otp.enabled`=false,
  `mfa.enabled`=false, `passwordAuth.enabled`=true (already matching SPEC — still set explicitly);
  field `name` exists (text, required **false**, max 255); field `avatar` exists (file, image
  mimes, `maxSize` **0** = unlimited).
- Rule semantics: **`null` = locked (superusers only); `""` = anyone.** The invite gate is
  `createRule = null`.
- `emailVisibility` is a **per-record bool field** (system, default false), *not* a collection
  option — SPEC §7's "email visibility off" is satisfied by leaving records at the default.
  There is nothing to configure at the collection level; do not hunt for an option.
- JSVM migration API (from `pb/pb_data/types.d.ts`): `migrate((app) => {...}, (app) => {...})`;
  `app.findCollectionByNameOrId("users")`; `collection.fields.getByName(name)` returns the field
  (mutate in place); auth options accessible directly on the collection
  (`users.authToken.duration`, `users.oauth2.enabled`, `users.passwordAuth.enabled`, …);
  persist with `app.save(users)`.

**PB JS SDK 0.27.0:** superusers auth via `pb.collection('_superusers').authWithPassword(...)`
(SDK docs state it directly); `pb.collection('users').authRefresh()`; `pb.authStore.record`
(type `AuthRecord`), `pb.authStore.clear()`, `pb.authStore.onChange(cb)` → **returns an
unsubscribe fn** (perfect `useSyncExternalStore` subscribe signature); file URLs via
`pb.files.getURL(record, filename)` (old `getUrl` deprecated).

**Superuser CLI (ran `./pb/pocketbase superuser --help`):** subcommand `upsert` exists
("Creates, or updates if email exists"). The global `--dir` **defaults to `pb/pb_data`** when the
binary lives at `pb/pocketbase` (resolved relative to the executable) — so from repo root,
`./pb/pocketbase superuser upsert EMAIL PASS` works with no flags. README documents that form.

**lucide-react 1.24.0** (post-cutoff 1.x major — icon set verified by grep of its `.d.ts`):
`Home` **does not exist**; it is now **`House`**. Verified present: `House`, `Library`, `Plus`,
`FolderHeart`, `BookOpen`, `ChevronLeft`. If any other icon is needed during build, grep
`node_modules/lucide-react/dist/lucide-react.d.ts` first — do not trust remembered 0.x names.

## Build steps

### 1. Migration — `pb/pb_migrations/<unix_seconds>_configure_users.js`

First migration; sets the naming precedent (current epoch seconds + snake description).
Auto-applied on `serve` (automigrate default true). Content — **up**:

```js
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.listRule = '@request.auth.id != ""'
  users.viewRule = '@request.auth.id != ""'
  users.createRule = null                 // locked — this IS the invite gate (SPEC §9)
  users.updateRule = 'id = @request.auth.id'
  users.deleteRule = null                 // locked
  users.passwordAuth.enabled = true       // explicit, self-documenting (already default)
  users.oauth2.enabled = false
  users.otp.enabled = false
  users.mfa.enabled = false
  users.authToken.duration = 7776000      // 90 days (SPEC §7)
  users.fields.getByName('name').required = true
  users.fields.getByName('avatar').maxSize = 5242880  // 5 MB
  app.save(users)
}, (app) => { /* down: restore the verified fresh-install defaults listed above
                (createRule '', all four other rules 'id = @request.auth.id',
                 authToken.duration 432000, name.required false, avatar.maxSize 0) */ })
```

Idempotent by construction (absolute assignments, no adds/removes), correct on both the existing
dev `pb_data` and a fresh one.

### 2. PB singleton + auth boot — `web/src/lib/pb.ts`, `web/src/lib/auth.tsx`

- `pb.ts`: `export const pb = new PocketBase(window.location.origin)` — same-origin via the Vite
  proxy (no CORS anywhere, SPEC §4); token persists in localStorage (SDK default).
- `auth.tsx`: `AuthProvider` + `useAuth()` exposing `{ user, booting }`. Precise contract:
  - `user` via `useSyncExternalStore((cb) => pb.authStore.onChange(cb), () => pb.authStore.record)`
    — no missed updates between render and subscribe, no manual useState mirroring.
  - `booting` starts as `pb.authStore.isValid` (no stored token → `false` immediately, no splash
    flash for logged-out visitors). One mount effect: if a token exists,
    `pb.collection('users').authRefresh().catch(() => pb.authStore.clear()).finally(() => setBooting(false))`.
    This is SPEC §9 verbatim: success silently extends the 90-day window; failure clears →
    ProtectedRoute redirects declaratively. (StrictMode double-fire of the effect is harmless —
    authRefresh is idempotent.)
  - Context carries `{ user, booting }`; `useAuth()` throws if used outside the provider.

### 3. Login — `web/src/routes/LoginPage.tsx` + `web/src/components/YarnBall.tsx`

Centered card on cream `bg-base-200` (DESIGN §9): YarnBall mark → lowercase **`stitches`**
wordmark (`font-display` = Baloo 2, weight 700) → email + password → one big `btn btn-primary`
pill → footer **"Stitches is invite-only ♡"**. No signup path.

- **Already-authed redirect (was missing):** if `user` is set, render
  `<Navigate to="/" replace />`. This declaratively covers both "logged-in visitor opens /login"
  and "login just succeeded" (authStore change re-renders) — no imperative `navigate()` call
  needed in the submit handler.
- Form: react-hook-form + `zodResolver`; schema `{ email: z.email(), password: z.string().min(1) }`
  (zod 4: `z.email()` is top-level). Submit → `pb.collection('users').authWithPassword(email, password)`.
  On error: gentle inline copy ("That didn't match — check your email and password.") per DESIGN
  §11; log the raw error to console (surface loudly for debugging, gentle for the user). Disable
  the button while submitting.
- iOS input rules (DESIGN §8/§12): inputs ≥48 px tall, **≥16 px font**, visible labels (never
  placeholder-as-label); daisyUI `input`; button min-height 48 px.
- `YarnBall.tsx` (DESIGN §6, binding): inline SVG, "a thread draws a circle" concept. Flat fills
  from tokens only via CSS vars (`var(--color-primary)` ball, `var(--color-base-content)` espresso
  strokes) — tokens flip per theme, so one asset reads on both cream and navy. No gradients, no
  blur; strokes 2.5–3 px, round caps/joins; round chubby geometry; `size` prop, ~96–128 px on
  login. Also reused as the boot splash (yarn ball = the loading motif).

### 4. Protected route + router — `web/src/components/ProtectedRoute.tsx`, `web/src/main.tsx`

- `ProtectedRoute`: `booting` → full-screen splash (YarnBall, `min-h-dvh`); else `!user` →
  `<Navigate to="/login" replace />`; else `<Outlet />`. UX sugar only — enforcement is the PB
  rules from step 1.
- `main.tsx`: import `base.css`; wrap the router in `<AuthProvider>`; route tree:

```
/login                          → LoginPage (public)
(pathless) ProtectedRoute
  └─ /                          → AppShell (layout: header + Outlet + dock)
       index                    → HomePage
       patterns                 → LibraryStub
       projects                 → ProjectsStub
       settings                 → SettingsStub   (BackBar demo + logout; avatar target)
       tokens                   → TokensPage     (keep, now inside the shell — still throwaway)
```

### 5. Shell + iOS hygiene

- `AppShell.tsx`: `min-h-dvh` flex column — `<AppHeader/>`, scrollable `<main>` (`<Outlet/>`),
  `<Dock/>`. Replaces `App.tsx` (delete it — its comment says the real shell arrives in 0.2).
- `AppHeader.tsx`: greeting using `user.name` + avatar button → `/settings` (settings has no dock
  slot, DESIGN §8). Avatar: seeded users have no avatar file → **initials-in-circle placeholder**
  (daisyUI `avatar-placeholder`, patch-color background via CSS var); when `user.avatar` exists
  use `pb.files.getURL(user, user.avatar)`. Header padding respects `env(safe-area-inset-top)`.
- `Dock.tsx`: daisyUI `dock`, **Home · Library · ➕ · Projects** (Friends joins in the sharing
  phase). `NavLink` active states; 24 px lucide icons — **`House`**, `Library`, `Plus`,
  `FolderHeart` (verified names, see facts above); 12 px labels; raised **56 px** center circle
  `bg-primary` with espresso `Plus` (`text-base-content`... espresso = base-content on the light
  theme — use `text-base-content` per tokens, no hex); ➕ is a placeholder action this session
  (quick-add sheet lands Phase 1); `padding-bottom: env(safe-area-inset-bottom)`.
- `BackBar.tsx`: 56 px top bar — `ChevronLeft` back control + optional lowercase title.
  **Cold-start fallback (was missing):** in a standalone PWA a subpage can be the first history
  entry, so `navigate(-1)` would no-op. Use React Router's history index:
  `const canGoBack = (window.history.state?.idx ?? 0) > 0`, then `canGoBack ? navigate(-1) :
  navigate('/', { replace: true })`. Tap target ≥44 px.
- Stubs `HomePage / LibraryStub / ProjectsStub / SettingsStub` in `web/src/routes/`: minimal,
  themed, whimsy-lite. `SettingsStub` = `<BackBar title="settings"/>` + **logout** button
  (`pb.authStore.clear()` — ProtectedRoute redirects declaratively; no imperative navigate).
- `web/src/styles/base.css` (imported in `main.tsx`; **no colors/fonts** — theme.css stays sole
  source): `-webkit-tap-highlight-color: transparent`; `touch-action: manipulation` on
  `a, button, input, select, textarea, [role="button"]`; heights via `dvh` only; all interactive
  controls ≥44×44 px; visible `:focus-visible` ring (2 px `var(--patch-blue-deep)`, offset 2 px,
  DESIGN §13); respect `prefers-reduced-motion` for any transition added.

### 6. Seed + README + DECISIONS + session log

- `scripts/seed.mjs`: zero-dep besides `pocketbase` (resolves from root `node_modules` —
  verified installed). Flow: read env (`PB_URL` default `http://127.0.0.1:8090`,
  `SUPERUSER_EMAIL`, `SUPERUSER_PASSWORD`, `SEED_USER{1,2}_{EMAIL,PASSWORD,NAME}`) — **fail
  loudly listing every missing var** (no fallbacks); `pb.collection('_superusers').authWithPassword(...)`;
  per user: `getFirstListItem(\`email="…"\`)` → exists: log "skip"; 404 → `create({ email,
  password, passwordConfirm, name, verified: true })` (superuser bypasses the locked createRule;
  leave `emailVisibility` at default false per SPEC). PASS/FAIL log lines + non-zero exit on
  error, mirroring `scripts/verify/contrast.mjs` style.
- Root `package.json`: add `"seed": "node scripts/seed.mjs"`.
- `README.md` (new, repo root): prereqs (Node 24.18.0); first run (`npm install`,
  `npm run dev` — downloads PB v0.39.6, applies migrations); **superuser:**
  `./pb/pocketbase superuser upsert EMAIL PASS` from repo root (`--dir` already defaults to
  `pb/pb_data`; dashboard install URL is the alternative); **seed:** export the env vars +
  `npm run seed`; phone testing via `tailscale serve` (Vite `allowedHosts` already includes
  `.ts.net`); pointers to `docs/`.
- `docs/DECISIONS.md` — two lines: wordmark lowercase `stitches` (§14 over §9); `lucide-react`
  pinned 1.24.0 (post-cutoff 1.x major — icon names verified against the package, `Home`→`House`).
- `logs/2026-07-11_session-0.2-auth-shell.md` at session end (project CLAUDE.md requirement —
  was missing from the draft plan).

## File map

**New:** `pb/pb_migrations/<ts>_configure_users.js` · `web/src/lib/pb.ts` · `web/src/lib/auth.tsx`
· `web/src/components/{YarnBall,ProtectedRoute,AppShell,AppHeader,Dock,BackBar}.tsx` ·
`web/src/routes/{LoginPage,HomePage,LibraryStub,ProjectsStub,SettingsStub}.tsx` ·
`web/src/styles/base.css` · `scripts/seed.mjs` · `README.md` · `logs/2026-07-11_….md`

**Modified:** `web/src/main.tsx` (AuthProvider, route tree, base.css import) · root
`package.json` (seed script) · `docs/DECISIONS.md`. **Deleted:** `web/src/App.tsx` (superseded
by AppShell).

## Verification

**Claude runs:** `npm run lint` · `npx tsc -b web` (typecheck) · `npm run verify:contrast`.

**Zara runs:** `npm run dev` · `./pb/pocketbase superuser upsert EMAIL PASS` · export seed vars +
`npm run seed` · `tailscale serve` (already connected).

**Acceptance:**
1. Login with seeded user → themed shell; **wrong password → gentle inline error**; logout via
   settings → `/login`; reload while logged in → `authRefresh` keeps the session.
2. 📱 iPhone via tailscale: fonts load, dock respects the bottom safe-area, tap targets ≥44 pt,
   back affordance visible on `/settings`.
3. Rules check (PB dashboard or curl): `users` createRule locked, token duration 7776000.

## Residual risks (all majors verified; these are write-time details only)

1. Exact JSVM property spelling in the migration — `types.d.ts` is in-repo; if `app.save(users)`
   errors on boot, PB logs it loudly to the dev.sh console.
2. zod 4 top-level `z.email()` vs `z.string().email()` — check against installed `zod` types
   when writing the schema (both may exist; prefer the non-deprecated one).

> On approval: mirror this plan to repo-root `PLAN.md` (per standing rule; distinct from
> `docs/PLAN.md`) before building.
