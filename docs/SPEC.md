# SPEC.md — Stitches Architecture Specification

*Version 1.0 · July 2026 · Developer: Zara · Companions: `DESIGN.md` (visual system & flows), `PLAN.md` (build phases). The original PRD lives at `docs/handoff.md`.*

---

## 1. What Stitches is

Stitches is a private, invite-only crochet pattern library and craft journal for a small friend
group (2–4 accounts, ever). It is a mobile-first web app — the primary user (Cece) lives on an
iPhone — with desktop as the secondary layout. Two core entities: **Patterns** (the library: things
you might make) and **Projects** (the journal: attempts at making them, with status, notes, photos,
and counters). One pattern can have many projects.

Hard constraints that shape everything below:

- **iOS Safari is the runtime.** No Vibration API (no haptics), PWA via Add to Home Screen, no
  share target. Counter feedback comes from motion, not vibration.
- **Copyright.** Pattern *instructions* — uploaded files and typed pattern text — are structurally
  owner-only and can never be shared, even when the pattern's metadata is. Enforced by API rules
  and protected files, not client code.
- **Cute is a requirement.** Token-driven theme, no glassmorphism, no backdrop blur, ever.
- **Self-hosted** on the existing Oracle Cloud Arm64 VPS alongside Zara's other projects.

## 2. Decision log

The drift-prevention anchor. Every AI build session should treat these as settled.

| Decision                                                                               | Why                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grey-cloud `stitches` subdomain + Let's Encrypt on the VPS                             | Cloudflare's proxy drops quiet SSE streams (~100 s idle), breaking PocketBase realtime; proxy adds nothing for an invite-only app. Rest of the domain keeps its current Cloudflare setup. |
| No SMTP anywhere                                                                       | Friend group talks daily; Zara resets passwords in the admin UI. Retrofit is trivial if ever needed.                                                                                      |
| 90-day auth tokens                                                                     | Nobody re-logs-in on their phone every two weeks.                                                                                                                                         |
| Journal = pinned summary + timestamped entries                                         | Summary is the *state* of a project; entries are the *diary*.                                                                                                                             |
| Photos live on journal entries; project has one cover photo                            | Every photo stays time-anchored; the project gallery aggregates entry photos.                                                                                                             |
| Pattern "completed" is derived from finished projects                                  | One source of truth. Pattern keeps a manual `shelf` field for library organization.                                                                                                       |
| Client-side image pipeline on every upload                                             | Solves HEIC, PocketBase thumbnail limits, and slow cell uploads in one move.                                                                                                              |
| Flaky-tolerant, not offline-first                                                      | Counter taps queue in a persisted outbox and flush on reconnect; app shell is precached. Full offline is Phase 5.                                                                         |
| Counters can link (`resets_with`)                                                      | Stitch counter resets when Rows increments; covers repeats too.                                                                                                                           |
| Dim mode on the counter screen only                                                    | Evening couch crochet. One scoped token swap, not a second app theme.                                                                                                                     |
| Dev is fully local; device testing via `tailscale serve`; prod cutover is a late phase | Never build in prod. Cece sees it when it's real.                                                                                                                                         |
| Backups: PocketBase scheduled → Cloudflare R2                                          | First off-VM backup routine; set-and-forget. Files stay on local disk (ample headroom).                                                                                                   |
| SVG motifs are made in-project (Zara + Claude)                                         | Style rules in `DESIGN.md` keep them coherent.                                                                                                                                            |
| Local LLM (gpt-oss on VPS)                                                             | Phase 5 stretch only: suggest CYC fields when page metadata is thin. Never on the critical path.                                                                                          |

## 3. Topology

```
iPhone / desktop browser
   │  HTTPS · DNS-only (grey-cloud) record → VPS public IP · Let's Encrypt TLS
   ▼
Nginx on the VPS
   ├── /            → static files (web build at /var/www/stitches/dist)
   ├── /api/  /_/   → 127.0.0.1:8090   PocketBase        (PM2)
   └── /import/     → 127.0.0.1:8095   importer sidecar  (PM2)
```

- `stitches.zalibhai.com` is the **one grey-clouded record** on the domain. Everything else stays
  proxied/Flexible as it is today.
- TLS via certbot with auto-renew; port 80 stays open for the ACME challenge and redirects to 443.
- PocketBase and the importer bind to localhost only. Nothing but Nginx is reachable from outside.

## 4. Environments & workflow

**dev (default).** Everything local: Vite dev server (5173), local PocketBase binary (8090),
importer (8095), started together by `npm run dev`. The Vite proxy maps `/api`, `/_`, and
`/import` to the local services, so the app is same-origin in dev exactly like prod — no CORS
configuration exists anywhere in this project. A seed script creates demo users and sample data.

**device testing.** `tailscale serve` in front of the Vite port gives a valid HTTPS URL on the
tailnet; open it on Zara's iPhone. HTTPS matters: Wake Lock, the service worker, and clipboard
reads all require a secure context. Add the `*.ts.net` hostname to Vite's `server.allowedHosts`
(dev config only).

**prod.** Provisioning and cutover are a deliberately late phase (see `PLAN.md`). Cece doesn't get
the URL until the app is substantially complete.

## 5. Pinned versions (verified July 2026)

| Piece | Version | Notes |
|---|---|---|
| PocketBase | v0.39.x | Prebuilt binary: `linux_arm64` (VPS), platform-detected for dev. Pin exact at scaffold. |
| PocketBase JS SDK | ^0.27 | |
| Node | 24 LTS | Dev machine and VPS. |
| Vite | current major | Whatever `create-vite` scaffolds (7/8-era; vite-plugin-pwa 1.3 supports both). |
| React / TypeScript | 19 / 5.x strict | |
| Tailwind CSS / daisyUI | 4.x / ^5.6 | CSS-first config; themes defined in CSS. |
| React Router | ^7 | Library mode, not framework mode. |
| TanStack Query | ^5 | All server state. |
| react-hook-form + zod | ^7 / ^4 | With `@hookform/resolvers`. |
| vite-plugin-pwa | ^1.3 | Workbox 7, `generateSW`. |
| UI bits | lucide-react, motion, @fontsource/baloo-2, @fontsource/nunito | Fonts self-hosted (PWA-friendly, no Google CDN). |
| Media | browser-image-compression, pdfjs-dist | Client-side only; zero native deps on the VPS. |
| Importer | Fastify ^5, @fastify/rate-limit, open-graph-scraper ^6, ipaddr.js | Node's global fetch (undici) for the guarded fetcher. |

Rule: exact versions get locked in `package.json` at scaffold time. If a new major has appeared by
then, read its migration notes before adopting — don't silently absorb breaking changes.

## 6. Repo layout

```
stitches/                      public GitHub repo · npm workspaces root (web, importer)
├── web/                       Vite + React app
│   └── src/
│       ├── styles/theme.css   ALL tokens + daisyUI themes (stitches, stitchesdim)
│       ├── lib/pb.ts          PocketBase client singleton
│       ├── lib/outbox.ts      counter write queue (§11)
│       └── features/          auth/ patterns/ projects/ counters/ import/ shared/
├── importer/                  Fastify sidecar · bundles to dist/server.mjs (no server npm install)
├── pb/
│   └── pb_migrations/         checked-in JS migrations — the ONLY way schema changes
│       (binary + pb_data are gitignored; dev script downloads the binary)
├── scripts/                   dev.sh · seed.mjs · deploy.sh
└── docs/                      handoff.md · SPEC.md · DESIGN.md · PLAN.md
```

## 7. Data model (PocketBase collections)

Conventions: every collection gets PB's `id/created/updated` for free. Every record carries an
`owner` relation so rules stay one-liners. Rich text uses PB's `editor` field (stored HTML).
Select values are lowercase snake; UI labels live in the frontend. Hook sizes: **metric mm is
authoritative**, US letters are display aliases only.

### users (auth collection)
`name` text required · `avatar` file image ≤5 MB.
Options: password auth only (OAuth off, OTP/MFA off), email visibility off,
**auth token duration 7,776,000 s (90 days)**.
Rules: list/view `@request.auth.id != ""` · create **locked** (superusers only — this *is* the
invite gate) · update `id = @request.auth.id` · delete locked.

### patterns
| field | type | notes |
|---|---|---|
| owner | relation → users, required | |
| title | text, required | |
| designer | text | |
| source_url | url | |
| source_name | text | "Ravelry", "Grandma's binder" |
| craft | select: crochet · knitting · tunisian · other | default crochet |
| yarn_weight | select: cyc_0 … cyc_8 | UI shows CYC names (Lace … Jumbo) |
| hook_mm | number | US letter alias rendered in UI |
| gauge | text | freeform: "14 sc × 16 rows = 4 in" |
| yardage / yardage_max | number | |
| difficulty | select: beginner · easy · intermediate · experienced | |
| shelf | select: saved · want_to_make · queued | default saved. "Completed" is derived — §7.9 |
| visibility | select: private · friends | default private |
| tags | relation → tags, multiple | |
| thumbnail | file image, 1, ≤5 MB | |
| photos | file image, ≤10 × ≤8 MB | inspiration/source shots |
| notes | editor | |

Rules:
- list/view: `owner = @request.auth.id || visibility = "friends"`
- create: `owner = @request.auth.id`
- update: `owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)`
- delete: `owner = @request.auth.id`

(The update guard blocks owner transfer. Same shape on every owned collection below.)

### pattern_attachments — the copyright vault
`owner` + `pattern` relations required (cascade-delete with pattern) · `label` text ·
`files` file ≤10 × ≤30 MB, MIME `application/pdf, image/jpeg, image/png, image/webp`,
**Protected flag ON** · `pattern_text` editor.
Rules: **every** rule `owner = @request.auth.id`; create additionally requires
`pattern.owner = @request.auth.id`.
Protected files are served only with a short-lived token (`pb.files.getToken()`), and PB re-checks
the view rule on every fetch — a leaked URL is useless. This plus owner-only rules is the
structural sharing guarantee from the handoff.

### projects
`owner` required · `pattern` relation → patterns, **optional** (improvised makes are first-class;
the UI encourages linking, never requires it; `cascadeDelete` off, so deleting a pattern with
linked projects is blocked and the UI offers "unlink first") · `name` text required ·
`status` select: planned · in_progress · finished · frogged · hibernating (default planned) ·
`started_on` / `finished_on` dates · `hook_mm` number · `yarn_used` text ·
`summary` editor (the pinned summary) · `cover` file image 1 × ≤8 MB ·
`visibility` select private · friends (default private).
Rules: same shape as patterns (visibility-aware read, owner-only writes).

### journal_entries
`owner` required · `project` required (**cascadeDelete ON** — a project's diary dies with it) ·
`entry_date` date required (UI defaults to today; editable, so backdating works) ·
`body` editor · `photos` file ≤6 × ≤8 MB.
Visibility is **inherited from the project** — sharing a project shares its story; keep the
project private to keep the diary private.
Rules:
- list/view: `owner = @request.auth.id || project.visibility = "friends"`
- create: `owner = @request.auth.id && project.owner = @request.auth.id`
- update/delete: `owner = @request.auth.id`

### counters
`owner` required · `project` required (cascadeDelete ON) · `label` text required ·
`value` number, default 0, min 0 · `target` number optional ·
`resets_with` relation → counters, single, optional — "when that counter increments, I reset
to 0." Stitch counter → `resets_with` = Rows; also covers pattern-repeat trackers. Client enforces
same-project; resets fire only on increments, so chains can't loop.
Rules: all owner-only. Counters are personal process and are never shown to friends, even on
shared projects (per handoff).

### tags
`owner` required · `name` text required · `color` select: **blue · coral · lilac · mint · butter**
(the five accent token names from `DESIGN.md` — every tag stays on-palette forever).
Unique index on `(owner, name)`.
Rules: list/view `@request.auth.id != ""` (shared patterns must render their tags) ·
create/update/delete owner-only.

### 7.9 Derived facts & query notes
- **"Made ✓" badge:** a pattern counts as made if any visible project on it is `finished`. The
  client fetches the viewer's finished projects once (`fields=pattern,status`) and maps ids —
  trivial at four users, and no denormalized flag to keep in sync.
- Library search = PB filter over `title ~ q || designer ~ q`, combined with shelf / craft /
  weight / tag filters carried in URL params.
- Common expands: pattern detail → tags; project detail → pattern; friends feed → owner.
- Indexes on `patterns(owner)`, `projects(owner)`, `journal_entries(project)`,
  `counters(project)` — politeness, not necessity, at this scale.

## 8. Files & media pipeline

- **Every image upload runs the client pipeline first** (`browser-image-compression`): decode →
  resize to ≤2000 px long edge → re-encode WebP (JPEG fallback) at ~0.85 quality. One step solves
  three problems: iPhone HEIC (Safari decodes HEIC natively, which is exactly where HEIC comes
  from), PocketBase's thumbnailer not reading HEIC, and multi-MB uploads on sketchy cell data.
  Image fields accept only jpeg/png/webp/gif; an undecodable file (HEIC dropped into desktop
  Chrome) gets a clear "please convert this one" error instead of a broken thumbnail later.
- **Lists never load originals.** Grids request PB's on-the-fly variants (`?thumb=400x0` etc.).
- **PDF → thumbnail, client-side:** on attachment upload, `pdfjs-dist` renders page 1 to a canvas
  → WebP → if the pattern has no thumbnail yet, this becomes it. That *is* the file-first import
  door. Zero native image deps on the VPS.
- Size caps live on the fields (§7) plus Nginx `client_max_body_size 50m`.

## 9. Auth policy

- **Invite-only:** users `createRule` is locked; Zara creates the 2–3 accounts in the dashboard.
  Public signup does not exist as a concept.
- **Login:** email + password. SDK keeps the token in localStorage; on boot the app calls
  `authRefresh()` — success silently extends the 90-day window, failure clears and routes to
  `/login`.
- **Resets:** manual, via dashboard. No SMTP. (Retrofit path if this ever grows: PB Settings →
  Mail, ten minutes.)
- The **superuser** (dashboard) account is separate from the users collection; created once with
  `./pocketbase superuser upsert EMAIL PASS`.

## 10. Importer sidecar — contract

Why it exists: URL metadata extraction must be server-side (browser CORS forbids it), and
server-side fetching of arbitrary URLs demands SSRF care. Fastify + TypeScript, bundled to a
single `dist/server.mjs`, bound to `127.0.0.1:8095`. Env: `PORT`, `PB_URL=http://127.0.0.1:8090`.

**Auth:** every request carries the caller's PB token (`Authorization` header). The importer
validates it against PB's `GET /api/collections/users/auth-refresh` (result cached in memory
~5 min per token). The importer holds **no** admin credentials.

**`POST /import/extract`** — body `{ "url": string }`. The fetch pipeline, in order (this *is* the
SSRF contract):
1. Parse; allow only `http/https`; strip embedded credentials.
2. Resolve DNS; reject private/reserved targets via `ipaddr.js` — loopback, RFC 1918, link-local,
   CGNAT `100.64/10`, and IPv6 equivalents.
3. Fetch with global `fetch` and `redirect: "manual"`; follow ≤3 redirects, **re-running step 2
   per hop**. 8 s total timeout, 3 MB response cap, require `text/html`. Honest UA:
   `StitchesImporter/1.0 (+repo URL)`.
4. Hand the HTML *string* to `open-graph-scraper` (`{ html }` input — OGS never fetches; all
   network stays inside the guarded pipeline).
5. Normalize.

Success →
```json
{ "source_url": "…", "canonical_url": "…", "title": "…", "description": "…",
  "image": "https://…", "site_name": "…", "author": null }
```
(all nullable except `source_url`). Errors: 400 invalid URL · 401 bad token · 403 blocked target ·
422 fetch failed / not HTML · 429 rate limited.

**`POST /import/image`** — body `{ "url": string }`. Same guard pipeline; requires `image/*`;
≤10 MB; streams the bytes back. The client wraps them in a File, runs the §8 pipeline, uploads as
the thumbnail. (Needed because the page's `og:image` is equally CORS-blocked client-side.)

Rate limit: 40 req/min per user (`@fastify/rate-limit`, keyed by user id; raised from 20 when
the Ravelry search door made browsing chattier — DECISIONS 2026-07-19). Logs to stdout; PM2
captures.

**Frontend flow:** the quick-add screen has a Paste button (`navigator.clipboard.readText()` on
tap — iOS shows its permission bubble; expected). Extract → save form pre-filled → Cece confirms
and enriches → pattern created. Extraction failure is *soft*: the form opens with just the URL
filled. Manual entry is never blocked by a bad scrape.

## 11. Realtime & the flaky-network strategy

- **Realtime scope: counters only**, subscribed per open project. PB realtime is SSE; through
  Nginx it needs `proxy_buffering off`, HTTP/1.1 upstream, and a long read timeout (§13). PB caps
  a realtime connection at ~30 min by default; the SDK reconnects transparently.
- **The counter outbox** (`web/src/lib/outbox.ts`): every counter action is an op —
  `inc(counterId, +n)` or `set(counterId, value)` (resets, manual edits). Ops apply to the
  TanStack Query cache instantly (optimistic), append to a localStorage-persisted FIFO queue, and
  a flusher sends them in order — coalescing consecutive incs per counter — on queue-append, the
  `online` event, window focus, and a 10 s tick while non-empty. **Increments use PocketBase's
  atomic `{"value+": n}` modifier**, so two devices can never clobber each other; resets are
  last-write-wins sets, acceptable at this scale. A small "syncing" stitch icon shows while the
  queue is non-empty. Survives app kill and dead zones; needs no background-sync API.
- **Linked resets** run client-side: incrementing counter A enqueues `inc(A,+1)` plus `set(B,0)`
  for every B whose `resets_with = A`.
- **PWA** (`vite-plugin-pwa`, `generateSW`, `registerType: autoUpdate`): precache the app shell;
  `navigateFallback: index.html` with `/api`, `/_`, `/import` denylisted. Runtime caching:
  CacheFirst for fonts and record thumbnails (`/api/files/…` for patterns/projects/journal, 30 d,
  ~300 entries); NetworkOnly for everything else under `/api`. Protected attachment URLs are never
  cached. Net effect: Stitches opens and paints on garbage signal; data arrives when the network
  does. Full offline stays in Phase 5, deliberately.
- **Wake lock:** counter screen offers keep-awake (`navigator.wakeLock`, re-acquired on
  `visibilitychange`); preference remembered locally.
- **Dim counter mode:** `data-theme="stitchesdim"` on the counter surface subtree (daisyUI themes
  scope to any subtree). Moon toggle, preference in localStorage. Token values in `DESIGN.md`.

## 12. Frontend architecture

**Routes** (React Router, library mode):
`/login` · `/` (home: "on the hook right now" + quick add) · `/patterns` (filters in URL params) ·
`/patterns/new` (accepts `?url=` prefill) · `/patterns/:id` · `/patterns/:id/edit` · `/projects` ·
`/projects/new` (`?pattern=`) · `/projects/:id` (summary + journal feed + counters) ·
`/projects/:id/count` (full-screen counter surface) · `/friends` (sharing phase) · `/settings`.

**State:** server state lives exclusively in TanStack Query over the PB SDK singleton
(`lib/pb.ts`); query keys namespaced per collection; mutations invalidate. Counters bypass into
the outbox. No global client-state library — component state and URL params carry the rest.

**Forms:** react-hook-form + zod resolvers. Zod schemas per collection live in one module as the
client-side mirror of the PB schema; server rules remain the real enforcement.

**Errors:** one helper normalizes PB's error shape; toasts for transient failures, inline messages
for field errors. TS strict; ESLint + Prettier defaults; no CI in v1.

iOS-specific viewport, touch, and safe-area rules live in `DESIGN.md` (hygiene checklist) and are
binding.

## 13. Nginx (prod)

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name stitches.zalibhai.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name stitches.zalibhai.com;

    ssl_certificate     /etc/letsencrypt/live/stitches.zalibhai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stitches.zalibhai.com/privkey.pem;

    root /var/www/stitches/dist;
    client_max_body_size 50m;          # vintage scans get chunky

    location /assets/ {                # hashed build assets only
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location / { try_files $uri /index.html; }
    # index.html and sw.js intentionally get no long-lived cache header

    location /api/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;           # realtime (SSE) silently dies without this
        proxy_read_timeout 1h;         # …and without this
    }

    location /_/ {                     # PocketBase dashboard
        auth_basic "stitches admin";
        auth_basic_user_file /etc/nginx/.htpasswd-stitches;
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /import/ {
        proxy_pass http://127.0.0.1:8095;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

DNS: A/AAAA record for `stitches` → VPS public IP, **proxy OFF (grey cloud)**. Nothing else on the
domain changes.

## 14. Ops

- **PM2** (`ecosystem.config.cjs`): `stitches-pb` (the binary:
  `serve --http=127.0.0.1:8090 --dir=… --migrationsDir=…`) and `stitches-importer`
  (`node dist/server.mjs`). `pm2 save` + startup, same as the other services on the box.
- **Deploy** (`scripts/deploy.sh`): build web → rsync `dist/` → rsync `pb_migrations/` → rsync the
  importer bundle → `pm2 restart stitches-pb stitches-importer`. PB applies new migrations
  automatically on start. One command, idempotent, no build steps on the VPS.
- **Backups:** PB Settings → Backups: daily cron (`0 11 * * *` ≈ 3 am Pacific), keep 7, S3 target
  = a Cloudflare R2 bucket (S3-compatible endpoint `https://<account>.r2.cloudflarestorage.com`,
  force path-style on). Backup zips include the SQLite DB **and** uploaded files, so watch zip
  size as photo libraries grow; keep-7 inside R2's free 10 GB is ample runway. With no SMTP,
  failures are silent — checking the Backups panel is a recurring chore noted in `PLAN.md`.
  Live file storage stays on local disk; R2 is backup-only.
- Logs: PM2 defaults. Nothing fancier in v1.

## 15. Security posture (v1)

Access control lives in PB API rules only — client checks are UX sugar. Attachments are Protected
and owner-only (§7). The importer is the single component that touches arbitrary URLs and carries
the full SSRF pipeline (§10) plus its own rate limit. The dashboard sits behind Nginx basic auth
*and* PB's superuser login. Both services bind to localhost. Auth is invite-only with no signup
surface. PB ships a built-in rate limiter — leave it at defaults; nothing about a four-person app
needs more. No CSP in v1; revisit only if Stitches ever grows past the friend group.

## 16. Working agreements — every build session inherits these

1. **Dependencies over hand-rolling**, always. Reinventing wheels is a bug here.
2. **Schema changes only via checked-in `pb_migrations` files.** Never click-edit prod schema.
3. **Colors and fonts only via tokens** in `theme.css`. No hex in components. No backdrop blur, ever.
4. **Mobile-first:** design every screen at ~390 px; desktop is the adaptation.
5. **Security lives in PB rules**, not client checks.
6. **Pin exact versions at scaffold**; a surprise new major means reading migration notes first.
7. **Each PLAN phase ends at its acceptance criteria**, verified on a real iPhone via
   `tailscale serve`.
8. **Uncertain? Stop and ask Zara** — especially about platform and workflow assumptions.
   (See: the Android haptics incident.)

## 17. Explicitly out of scope for v1

Ravelry enrichment (Phase 5, server-side key in the importer, self-throttled), public share links,
browser extension, full offline browsing, yarn stash, push notifications, SMTP, multi-group
tenancy, and the local-LLM import assist (Phase 5 stretch: feed page text to the VPS's gpt-oss to
*suggest* CYC fields when metadata is thin — suggestion-only, never critical path).