# PLAN.md — Stitches Build Plan

*Version 1.0 · July 2026 · Companions: `SPEC.md` (architecture — binding), `DESIGN.md` (visual
system — binding), `docs/handoff.md` (original PRD). No deadline; sessions are sized to one
sitting, not to dates.*

---

## How to run a session

Every session (Claude Code or otherwise) starts the same way: read `CLAUDE.md`, `docs/SPEC.md`,
`docs/DESIGN.md`, `docs/DECISIONS.md`, and the one session brief below being executed. State a
short plan, then build. Small commits with plain messages. If anything is ambiguous or contradicts
the docs, **stop and ask Zara** — never resolve ambiguity by assuming (see: the Android haptics
incident). A session is done when every acceptance box checks, verified where marked 📱 on a real
iPhone via `tailscale serve`. If the session deviated from SPEC/DESIGN in any way, append one line
to `docs/DECISIONS.md` saying what and why.

## Standing working agreements (restated from SPEC §16)

Dependencies over hand-rolling. Schema only via checked-in `pb_migrations`. Colors and fonts only
via tokens — no hex in components, no backdrop blur ever. Mobile-first at ~390 px. Security lives
in PocketBase API rules; client checks are UX sugar. Pin exact versions at scaffold; read
migration notes before adopting any surprise new major. Whimsy in empty states and celebrations;
plain language in forms and destructive flows.

---

## Phase 0 — Skeleton & craft room *(fully local; the VPS is not touched)*

### Session 0.1 — Scaffold & theme
**Goal:** a running local dev environment that already looks like Stitches.
**Build:** npm-workspaces repo per SPEC §6; Vite + React + TS (strict) + Tailwind 4 + daisyUI in
`web/`; `theme.css` with both themes verbatim from DESIGN §2; `@fontsource` Baloo 2 + Nunito;
ESLint + Prettier; `scripts/dev.sh` that platform-detects and downloads the pinned PocketBase
binary and starts PB + Vite together (Vite proxy for `/api`, `/_`, `/import`); a throwaway
`/tokens` demo route rendering swatches, chips, buttons, and a `stitchesdim` panel; root
`CLAUDE.md` distilling the agreements + doc pointers.
**Accept:**
- [x] `npm run dev` boots Vite + local PB; `/tokens` renders both themes correctly
- [x] Every text/background pair from DESIGN §3 passes AA in a contrast checker; results noted in the PR/commit
- [x] Exact dependency versions pinned; lint clean; `CLAUDE.md` and `docs/DECISIONS.md` exist

### Session 0.2 — Auth & app shell
**Goal:** log in, land in a themed shell, on a real phone.
**Build:** migration configuring the `users` auth collection per SPEC §7/§9 (create locked, OAuth
off, 90-day tokens); PB SDK singleton + `authRefresh` boot flow; login screen per DESIGN
(yarn-ball mark drawn this session under DESIGN §6 rules); protected-route wrapper; app shell —
header with avatar, 4-slot dock with raised ➕, in-app back affordance pattern; `scripts/seed.mjs`
v1 (two demo users); superuser setup documented in README.
**Accept:**
- [ ] Login/logout works against seeded user; wrong password gets a gentle inline error
- [ ] 📱 Via `tailscale serve`: fonts load, dock respects safe-area, tap targets ≥44 pt, back affordance visible on a stub subpage

---

## Phase 1 — The library

### Session 1.1 — Full schema & rules
**Goal:** the entire SPEC §7 data model exists, enforced, and provably so.
**Build:** one migration set creating patterns, pattern_attachments (files **Protected**),
projects, journal_entries, counters, tags — fields, defaults, cascade behavior, indexes, and API
rules exactly as written; seed extended (6 patterns, tags in all five colors, one shared + one
private per user); `scripts/rules-check.mjs` — exercises the access matrix (anonymous / owner /
other-user) against every collection, including "attachments invisible to a friend even when the
pattern is shared."
**Accept:**
- [x] Migrations apply cleanly to a fresh `pb_data`
- [x] `rules-check.mjs` green across the full matrix — this script is now a permanent regression test

### Session 1.2 — Pattern CRUD
**Goal:** Stitches works as Cece's manual-entry library.
**Build:** library list (2-col grid default, list toggle, sticky search, filter chips → sheet,
state in URL params); create/edit form per DESIGN (RHF + zod, CYC selects, `hooks.ts` mm↔US alias
map, inline tag creation with patch-color pick, sticky safe-area Save bar); the §8 image pipeline
module wrapping `browser-image-compression`; pattern detail view; delete with plain-language
confirm (blocked-by-projects path per SPEC).
**Accept:**
- [ ] 📱 Create a pattern with a camera-roll photo — HEIC converts, upload is fast, grid uses `?thumb=` variants
- [ ] 📱 Filters/search survive refresh and back button; hook field shows "5.0 mm · H-8"
- [ ] Empty library and empty-search states are distinct and on-voice

### Session 1.3 — Attachments & the file-first door
**Goal:** the copyright vault, and PDFs as an import door.
**Build:** owner-only attachments card (lock + "Only you can ever see these"); protected-file
access via `pb.files.getToken()`; pdfjs page-1 → WebP thumbnail on upload; file-first quick-add:
upload a PDF/scan → save form pre-filled with generated thumbnail → pattern + attachment created
together.
**Accept:**
- [ ] 📱 A vintage-scan PDF becomes a pattern with a page-1 thumbnail in one flow
- [ ] Fetching a protected file URL without a token fails; owner playback fine
- [ ] `rules-check.mjs` still green

---

## Phase 2 — The journal

### Session 2.1 — Projects & journal
**Goal:** the diary half is real.
**Build:** project CRUD (optional pattern link), projects list grouped by status; status sheet —
finished triggers star confetti (drawn this session), defaults `finished_on`, prompts an optional
finished-photo entry; pinned summary edit-in-place; journal feed — dated entries, photos, backdate
via editable date, composer on top; cover photo; frogged microcopy per DESIGN §11.
**Accept:**
- [x] 📱 Full loop: start project → journal entry with photo → finish → confetti once → entry prompt
- [x] `prefers-reduced-motion`: no confetti, everything still updates instantly
- [x] Backdated entries sort correctly

### Session 2.2 — Counters
**Goal:** the flagship surface, flake-proof.
**Build:** counter CRUD (labels, targets, `resets_with` same-project links); `lib/outbox.ts` per
SPEC §11 — `value+` deltas, localStorage persistence, coalescing, flush on append/online/focus/
10 s tick; realtime subscription per open project; the full-screen surface per DESIGN §10 (pager +
live strip, `clamp` tap zone, −1/edit/reset row, progress bar, linked caption, sync stitch icon);
wake-lock toggle; dim mode subtree swap; settings groundwork for counter prefs.
**Accept:**
- [ ] 📱 Airplane mode: tap +1 ten times, kill and reopen the app, reconnect — server lands on the exact value
- [ ] Two browsers on one project: taps sync live both ways
- [ ] 📱 "Rows +1" zeroes the linked stitches counter; target hit pops one mint star
- [ ] 📱 Wake lock survives a tab-away-and-back; dim toggle persists; no double-tap zoom anywhere on the surface

### Session 2.3 — Home & settings
**Goal:** the app earns a home-screen spot.
**Build:** home per DESIGN — greeting, "on the hook" hero card(s) with live counter value and
snap-scroll for multiples, quick-add doors row, recent patterns strip, new-user empty state
(illustration drawn this session); settings screen — name/avatar, change password (old + new),
counter preferences incl. the experimental haptic-tick toggle (default off), sign out, version.
**Accept:**
- [ ] 📱 Cold open → counting on the active project in one tap
- [ ] Change-password works end to end (matters: there is no SMTP)

---

## Phase 3 — URL import

### Session 3.1 — Importer sidecar
**Goal:** SPEC §10, implemented to the letter.
**Build:** Fastify service — token validation with cache, the ordered SSRF pipeline, `/import/
extract`, `/import/image`, rate limit, single-file bundle; wired into `npm run dev` and the Vite
proxy.
**Accept:**
- [ ] Block tests all 403: `http://127.0.0.1:8090`, an RFC 1918 target, `169.254.169.254`, and a redirect chain ending private
- [ ] No/bad token → 401; >3 MB page → 422; a real blog URL → normalized JSON matching the contract

### Session 3.2 — Paste-a-link door
**Goal:** link in, cute pre-filled form out.
**Build:** quick-add screen with Paste button (`clipboard.readText` on tap), extract → save form
pre-filled + "imported from {site}" chip, `og:image` through the image proxy → §8 pipeline →
thumbnail, soft-failure path (URL-only form + gentle toast).
**Accept:**
- [ ] 📱 A Ravelry pattern page and a random craft-blog page both import; images arrive compressed
- [ ] A garbage URL degrades softly; manual entry is never blocked

---

## Phase 4 — Sharing & shine

### Session 4.1 — Friends
**Goal:** the group can see each other's makes — and only what they should.
**Build:** visibility toggles with the exact helper copy from DESIGN; Friends dock tab (5th slot
appears now); shared feed of patterns + finished objects with owner avatars; read-only detail
reuse — attachments and counters neither render nor hint for non-owners.
**Accept:**
- [ ] As user B: A's shared pattern shows metadata/photos/tags, zero attachment UI; shared project shows its journal; private items are invisible everywhere
- [ ] `rules-check.mjs` re-run green (regression)

### Session 4.2 — PWA, icon & polish
**Goal:** installable, fast, and finished-feeling.
**Build:** vite-plugin-pwa per SPEC §11 (precache, denylist, runtime caching); **icon decision
lands here** — pick A/B/C (currently deferred), refine the mark, generate maskable 512 +
apple-touch 180, manifest colors; empty/error-state sweep; micro-animation pass; light desktop
adaptation pass; walk DESIGN §12 item by item as an audit; bundle sanity (route-level splitting if
heavy).
**Accept:**
- [ ] 📱 Add to Home Screen → relaunch in airplane mode paints the shell
- [ ] 📱 Hygiene checklist: 13/13 on device, including keyboard-vs-sticky-Save
- [ ] Installed icon looks right on the actual home screen

---

## Phase 5 — Provision & launch *(the VPS enters here)*

### Session 5.1 — Provision & deploy
**Goal:** live at `stitches.zalibhai.com`.
**Build:** grey-cloud DNS record; certbot + auto-renew; Nginx block verbatim from SPEC §13;
htpasswd for `/_/`; PM2 apps + save/startup; `scripts/deploy.sh`; PB superuser; Backups → daily
cron → R2 bucket (force path-style); first deploy; run `rules-check.mjs` against prod.
**Accept:**
- [ ] 📱 Live over HTTPS; realtime counters sync across two devices through Nginx (the SSE proof)
- [ ] 30 MB PDF uploads; `/_/` demands basic auth; `deploy.sh` re-runs idempotently
- [ ] A backup zip appears in R2 and restores locally when downloaded

### Session 5.2 — Launch & care
**Goal:** Cece's app now.
**Build:** create the real accounts; Zara walks Cece through install + first pattern + first
count; write `docs/CARE.md` — monthly backup-panel check (no SMTP means failures are silent),
deliberate PocketBase updates only (read the changelog, then `./pocketbase update`), and where
everything lives on the VPS.
**Accept:**
- [ ] Cece adds a pattern and counts a row on her own phone, unassisted
- [ ] `CARE.md` exists and a monthly reminder is set somewhere Zara actually looks

---

## Phase 6 — Add-ons *(spec: `docs/ADDONS.md` — binding for these sessions)*

*Cece-approved set, spec'd 2026-07-19. Build order per ADDONS §1: stash → offline → share →
clipper; 6.4/6.5 only become genuinely useful once Phase 5 has shipped. Every session opens by
closing its ADDONS §7 verify-at-build items against the pinned binary / installed packages /
a real iPhone. (Ravelry enrichment, formerly in this backlog, shipped 2026-07-19 as R1–R3 —
`docs/RAVELRY.md`.)*

### Session 6.1 — Yarn stash
**Goal:** the stash is real — browsable, linkable, shared like everything else.
**Build:** ADDONS §2 — `yarns` + `projects.yarns` migration; rules with the link-guard fixtures
proven first (full friends-linkable mirror, fall back own-only at a real wall only); quiet-unlink
delete semantics; seed yarns; `features/yarn/` (list/detail/form, weight filters in URL params);
Library segmented tabs with the two-root dock active state; project yarn picker + chips; yarn
detail "used in"; rules-check extended in place.
**Accept:**
- [ ] `verify:fresh` green ×2, including the yarns matrix, link-guard fixtures, and the
      unlink-on-delete cascade proof
- [ ] 📱 Add a yarn with a photo, link it to a project — chip renders and taps through; delete
      the yarn — project and journal untouched
- [ ] Library tabs keep independent filter state across switches; stash empty state is on-voice

### Session 6.2 — Offline foundations
**Goal:** the app opens, browses, and reads offline; data survives app kills.
**Build:** ADDONS §3.1–3.5 — auth boot fix (network failure ≠ bad token; `unverified` retry);
query persistence (persist-client + async-storage-persister + idb-keyval, `__APP_VERSION__`
buster, fileToken never dehydrated); `lib/sync.ts` full-library sync + Settings `OfflineCard`
("Sync now", last-synced); `lib/files.ts` `thumbUrl()` refactor + thumbnail warming; cache cap
300 → ~2000; `useOnlineStatus()` + header offline indicator; non-counter mutations fail in
place with the offline message.
**Accept:**
- [ ] 📱 Airplane-mode cold reopen: session survives, library/projects/journals browse with
      images, indicator shows
- [ ] 📱 After one online "Sync now": a pattern never opened before renders fully offline;
      last-synced time updates
- [ ] Offline form Save stays put with the explicit message; counter taps still queue and flush
      on reconnect

### Session 6.3 — The vault on the go
**Goal:** chosen pattern files open on a plane.
**Build:** ADDONS §3.6 — per-attachment "Keep on this phone" toggle (one-shot token fetch →
owner-scoped IDB blobs, separate store); synchronous `<a href>` object-URL viewing with
`useRevokeOnUnmount`; per-file + aggregate sizes and "Clear all kept files" in `OfflineCard`;
cleanup on attachment delete and logout/identity change; defensive `storage.persist()`.
**Accept:**
- [ ] 📱 A kept PDF opens in airplane mode; an un-kept file explains itself instead of failing
      silently
- [ ] Deleting the attachment or logging out removes the kept copy (IDB verified empty)
- [ ] 📱 `blob:` PDF viewing verified on a real iPhone (or the pdfjs-viewer fallback decision
      logged in DECISIONS)

### Session 6.4 — Public share links
**Goal:** a link Cece can text her mom — and revoke.
**Build:** ADDONS §4 — `share_links` migration (partial unique indexes, XOR + target-owned
rules, owner-only everything); `pb/pb_hooks/share.pb.js` route with the explicit allowlist +
server-rendered postcard page (OG tags, noindex, inline token CSS); token minting (hook
preferred, client fallback); `ShareSheet` on both detail pages; Vite `/share` proxy + SW
`navigateFallbackDenylist` addition + `--hooksDir` in dev.sh **and** verify-fresh.sh; SPEC
§13/§17 edits; rules-check extended in place (owner matrix + raw-fetch `/share/{token}` +
attachments-absent proof).
**Accept:**
- [ ] `verify:fresh` green: share matrix, happy/revoked/garbage-token fetches, and the
      attachments-absent proof on a shared pattern that has vault files
- [ ] 📱 Link pasted in iMessage shows a preview card; the page reads cute on a phone, logged
      out; revoke kills it immediately
- [ ] An installed-PWA user tapping a share link reaches the postcard, not the SPA shell

### Session 6.5 — Desktop clipper
**Goal:** one click from a browser tab to the save form.
**Build:** ADDONS §5 — `extension/` (MV3 manifest, background open-in-tab with URL-API
construction + non-http guard, options page for the base URL, icons); `docs/clipper.md`
(load-unpacked walkthrough + bookmarklet); `ProtectedRoute` login-redirect preservation so a
logged-out deep link survives to its destination.
**Accept:**
- [ ] Load-unpacked → click on a real pattern page → `/patterns/new?url=…` opens prefilled;
      `chrome://` pages no-op
- [ ] Logged-out clipper tab: after login, lands back on the prefilled form (redirect fix)
- [ ] Bookmarklet works in a second desktop browser

---

## Stretch backlog *(unordered, un-planned, pull when wanted)*

gpt-oss import assist (suggest CYC fields from page text; suggestion-only) · Ravelry
purchased-PDF vault import (sketched in `RAVELRY.md` §8; not planned).
