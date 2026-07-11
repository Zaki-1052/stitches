

---

# Stitches — Handoff Document

*Working title. Version 1.0, July 2026. Developer: Zara. End user: Cece (she/they) plus one or two crocheting friends.*

## 1. Background & the ask

Cece needs a better way to manage her crochet pattern collection. Today her patterns are scattered across multiple websites, browser tabs, Ravelry, Ribblr, blogs, and vintage scans, with no single place to manage them. The ask, distilled from the original Discord conversation: pattern storage with status tracking (at minimum "want to make" and "completed"), multi-source import that is not limited to any single site (many vintage patterns never appear on Ravelry or Ribblr; manual entry is acceptable, automated scraping is not required), and an explicit aesthetic requirement that it must look **cute** — not utilitarian, not developer-default. Cece likes light blue; Zara otherwise has creative freedom. Platform is a website ("whatever is easier" per Cece), and Cece is almost always on her phone, so mobile layout is the primary target with desktop as the secondary view.

Reference points: **Ravelry** (ravelry.com) is the dominant pattern platform — Cece uses it but finds it limiting and aesthetically wrong. **Ribblr** shares the same gap around vintage and obscure patterns. The **ravelRy** R wrapper (github.com/walkerkq/ravelRy) was found during initial research as proof the Ravelry API is usable. Stitches complements these platforms' organizational role; it does not replicate them.

During planning, scope grew deliberately in two ways: per-project tracking (the craft-journal side) is a first-class goal, not an add-on, and a row/stitch counter is confirmed in scope. Access is a small invite-only friend group; everything is private by default with an option to share within the group. The project will live publicly on Zara's GitHub portfolio, hosted on her existing Oracle Cloud Arm64 VPS behind Nginx and Cloudflare DNS, with services managed by PM2.

## 2. Research digest: the landscape

This consolidates the prior deep-research session so the spec stands alone.

### Platforms and APIs

**Ravelry is the only platform with a real general-purpose API.** Base URL `api.ravelry.com`, returning JSON. Official docs at `ravelry.com/api` are login-gated, so the best public documentation is community wrappers, which confirm roughly 41 method groups spanning patterns, pattern search, yarns, projects, stash, queue, favorites, libraries, people, shops, and forums. Authentication comes in two useful flavors: read-only HTTP Basic Auth using a username and personal key created at `ravelry.com/pro/developer` (confirmed active as of July 2025, sufficient for reading public pattern and yarn data), and OAuth 2.0 for apps acting on behalf of other users. **No rate limits are published anywhere**, so any client must self-throttle and cache. Critically, the API returns *metadata only* — around fifty fields per pattern (name, designer, gauge, yarn weight, yardage, needle/hook sizes, difficulty, categories, attributes, photos, notes) but never full pattern instructions. The `pdf_url` field is populated only when a designer hosts a free PDF on their own site.

**Nobody else has an API.** Ribblr (interactive ePatterns, subscription-gated tracking), LoveCrafts, Yarnspirations (~10,000 free Shopify-hosted PDFs), Annie's, and AllFreeCrochet all offer no public developer API. Etsy has a modern Open API v3 (OAuth 2.0, 10,000 requests per day at 10 per second) but it is a marketplace API for shop management, not pattern content — largely irrelevant here. No open-source pattern *dataset* exists; community projects like CrochetPARADE, CrochetCharts, and Crochendo are tools (renderers, chart editors, parsers), not databases. Notably, **no mature open-source pattern manager exists at all** — Stitches fills a genuine gap.

### Standards and import techniques

There is **no machine-readable pattern schema** — no schema.org/Recipe equivalent for fiber arts. The de facto vocabulary standard is the **Craft Yarn Council (CYC)** Standards & Guidelines: the Standard Yarn Weight System (0 Lace through 7 Jumbo, recently extended with size 8), standardized abbreviations, skill levels, and hook/needle sizing where metric millimeters are authoritative and US letters are aliases. Stitch's controlled fields model directly on CYC.

Because patterns live on blogs, forums, and PDFs across the whole internet, the mechanism that scales is the one recipe managers proved: **URL-based metadata extraction** via Open Graph, Twitter Cards, and JSON-LD, which reliably yields title, description, and image, with everything else falling to heuristics or manual entry. Mature libraries exist (open-graph-scraper, metascraper, link-preview-js). Server-side fetching requires SSRF protection, and JavaScript-heavy sites would need headless rendering — explicitly out of scope for v1, falling back to manual entry.

### Platform risk and legal constraints

Ravelry's history argues against depending on it: the June 2019 content-policy controversy and the June 2020 redesign that triggered widely reported photosensitive reactions (including an Epilepsy Foundation warning) and a poorly handled response. The architecture treats Ravelry as an optional enrichment source that can vanish without harming the product.

The central legal constraint: pattern *instructions* are copyrighted. Stitches stores links, metadata, thumbnails, and the user's own notes freely. User-uploaded PDFs, scans, and typed pattern text are personal-use storage, **private to the owner and never shared or exposed**, even when the pattern's metadata is shared with friends. Stitches is an organizer, never a redistribution platform.

## 3. Product definition

**Core model: Patterns and Projects.** A Pattern is a library entry — the thing you might make — carrying metadata, tags, source link, and attachments. A Project is one attempt at making it, carrying status, the yarn and hook actually used, dates, journal notes, photos, and counters. One pattern, many projects: "I made this three times, differently each time" falls out naturally.

**Three equal import doors**, all landing on the same pre-filled editable save form: manual entry with pleasant controlled-vocab inputs, URL import that pre-fills from page metadata, and file-first import where uploading a PDF or scan creates the pattern with a generated thumbnail. No door is privileged; each just needs to feel good.

**Tracking and counters.** Projects carry statuses (planned, in progress, finished, frogged, hibernating), journal notes, and photos. Each project can have multiple named counters ("Rows," "Repeat," "Sleeve decreases") with optional targets. The counter screen is a first-class mobile surface: huge tap targets usable without looking, optimistic updates so taps feel instant, live sync across devices via PocketBase realtime, and a small haptic buzz on Android via the vibration API. (Note: this won't be possible, she's not on Android). The home screen leads with "on the hook right now" so Cece's active project and its counter are one tap away.

Meta Note: Assuming you can use Android vibrations is the kind of AI failure mode and assumption that it is imperative to avoid. When asking me questions, important boring logistical questions like this are important as well, not generic broads ones.

**Sharing.** Everything defaults to private. Patterns and projects each carry a visibility toggle (private or friends); since the instance is invite-only, "friends" simply means all authenticated users. Shared patterns expose metadata, thumbnail, photos, and the source link — never attached files or typed pattern text, which are structurally owner-only (see data model). Public share links are a future idea, not v1.

**Aesthetic.** Light blue pastel base, cream neutrals, soft rounded shapes, generous whitespace, a rounded display font (Baloo 2 or Quicksand territory) paired with a readable body font, sparing craft motifs (yarn balls, stitch marks), and gentle micro-animations. Built as a real token system — CSS custom properties consumed everywhere — so cuteness is coherent and tweakable, not sprinkled. It should feel like a personal craft room.

## 4. Architecture

### Guiding principle: dependencies welcome

A standing instruction for every build session, AI-assisted or otherwise: **prefer well-maintained dependencies over hand-rolling.** Auth, file storage, and admin come from PocketBase, not custom code. OG scraping, SSRF filtering, form validation, PDF rendering — all from established packages. Reinventing wheels is a bug in this project, not a virtue.

### Topology

Everything lives on the existing Oracle Arm64 VPS. Nginx terminates requests for the Stitches subdomain (Cloudflare-proxied DNS as usual) and does three things: serves the built React app as static files, reverse-proxies `/api/` and `/_/` to PocketBase, and reverse-proxies `/import/` to a small Node importer service. PocketBase and the importer both run under PM2, bound to localhost only.

**PocketBase** (official Linux arm64 binary) is the backend: SQLite data, invite-only auth (public signup disabled; Zara creates the two or three accounts in the admin UI), file storage with built-in on-the-fly image thumbnails via the `?thumb=` query parameter, an admin dashboard for free, server-sent-event realtime subscriptions powering counter sync, built-in scheduled backups, and JavaScript migration files checked into the repo so the schema is reproducible — which matters a lot for AI-assisted work.

**The importer sidecar** exists because URL metadata extraction must be server-side (CORS plus SSRF safety) and PocketBase's embedded goja hooks can't use npm's HTML-parsing ecosystem, which is exactly the wheel we refuse to hand-roll. It's a tiny Fastify service with one job: `POST /import/extract` takes a URL, validates the caller's PocketBase auth token, fetches through an SSRF-filtering agent (`request-filtering-agent` or equivalent — blocks private IP ranges), runs `open-graph-scraper` for OG/Twitter/JSON-LD, and returns normalized metadata for the save form. It's also the natural future home for Ravelry enrichment calls, keeping the API key server-side.

**PDF thumbnails happen client-side**: at upload time, `pdfjs-dist` renders page one to a canvas in the browser and uploads the resulting image alongside the file. No native server dependencies, no ImageMagick on the VPS.

### Frontend stack

React + TypeScript on Vite, output served statically by Nginx. Tailwind with **daisyUI** for themed, semantic, playful components — the fastest dependency-friendly route to distinctive-cute, customized via the token palette. React Router for routing, TanStack Query for server state layered over the official PocketBase JS SDK, react-hook-form + zod for the save forms, lucide-react for icons, and a light touch of the `motion` library for micro-delights. PWA manifest via vite-plugin-pwa so Cece can add Stitches to her home screen.

### Nginx sketch and gotchas

```nginx
server {
  server_name stitches.zalibhai.com;
  root /var/www/stitches/dist;

  location / { try_files $uri /index.html; }

  location /api/ {
    proxy_pass http://127.0.0.1:8090;
    proxy_buffering off;        # PocketBase realtime uses SSE
    proxy_read_timeout 1h;
  }
  location /_/      { proxy_pass http://127.0.0.1:8090; }
  location /import/ { proxy_pass http://127.0.0.1:8095; }

  client_max_body_size 50m;     # vintage scans get chunky
}
```

The two gotchas worth remembering: SSE needs `proxy_buffering off` and a long read timeout or realtime counters will silently die, and the upload body limit must be raised for scanned PDFs. Cloudflare's free-plan 100 MB upload cap is comfortably above ours. Optionally restrict `/_/` (the admin UI) by IP or an extra auth layer. Backups: enable PocketBase's scheduled backups and periodically copy the backup zips off-VM alongside whatever routine the other VPS projects use.

## 5. Data model (PocketBase collections)

```text
users (auth)         invite-only; name, avatar

patterns
  owner        relation → users (required)
  title        text (required)
  designer     text
  source_url   url
  source_name  text                        "Ravelry", "Grandma's binder"
  craft        select: crochet|knitting|tunisian|other
  yarn_weight  select: CYC 0–8
  hook_mm      number                      metric authoritative; US letter alias in UI
  gauge        text                        freeform: "14 sc × 16 rows = 4 in"
  yardage      number      yardage_max number
  difficulty   select: beginner|easy|intermediate|experienced
  list_status  select: saved|wishlist|queued
  visibility   select: private|friends     default private
  tags         relation → tags (multiple)
  thumbnail    file (image)
  photos       file (multiple)             inspiration/source photos
  notes        rich text

pattern_attachments                        ── owner-only, never shared
  owner, pattern (relations)
  files        file (multiple: pdf/image)
  pattern_text rich text                   full typed instructions
  label        text

projects
  owner, pattern (relations)
  name         text                        "Mom's birthday cardigan"
  status       select: planned|in_progress|finished|frogged|hibernating
  started_on / finished_on   dates
  hook_mm      number                      what was actually used
  yarn_used    text
  notes        rich text
  photos       file (multiple)             WIP + finished object
  visibility   select: private|friends     default private

counters
  owner, project (relations)
  label        text        value  number        target  number (optional)

tags
  owner        relation → users
  name         text        color  text (theme token name)
```

Access control lives in PocketBase API rules, not client code. Patterns and projects: view when `owner = @request.auth.id || visibility = "friends"`, create for any authenticated user, update and delete owner-only. `pattern_attachments` and `counters`: owner-only on every rule — this is the structural guarantee that copyrighted files and typed instructions never leak through sharing. Tags: viewable by any authenticated user (so shared patterns display them), editable by owner only.

## 6. Build plan

Each phase ends at a shippable checkpoint Cece can touch, which keeps AI-assisted sessions scoped and testable. Standing working agreements for those sessions: dependencies preferred, schema changes only through checked-in migrations, mobile-first layouts always, colors only through theme tokens, and security enforced in PocketBase rules rather than client checks.

### Phase 0 — Foundations and deploy skeleton

Repo scaffolding (`web/`, `importer/`, `pb/` for migrations, `docs/` holding this spec), Vite + React + TS + Tailwind + daisyUI wired to the initial token palette, PocketBase installed on the VPS under PM2, Nginx server block, DNS, TLS, and a one-command deploy script (build, then rsync `dist/` to the VPS). Deliverable: a themed login screen live ~~at the real domain~~. Getting deploy friction to zero *first* pays off every later phase.
Note: I will not deploy to the real domain. You never "build in prod". We test in dev. I've deployed constant apps and this is not a blocker. Phase 0 is more the skeleton and wiring and Spec decisions.
### Phase 1 — The library

Collections and rules via migrations, login flow, and full pattern CRUD: the mobile-first save form with CYC dropdowns and hook-size alias display, tags, photo uploads, owner-only attachments with client-side PDF thumbnailing, pattern list with search and filters (status, craft, weight, tags), and the pattern detail view. Deliverable: Cece can genuinely use Stitches as her manual-entry library.

### Phase 2 — The journal

Project CRUD hanging off patterns, statuses and dates, journal notes and photos, and the counter experience: multiple counters per project, huge increment buttons, optimistic updates, realtime sync, haptics(?). Home screen becomes "on the hook right now." Deliverable: the craft-journal half is real, and the app earns a home-screen spot on Cece's phone.

### Phase 3 — URL import

The Fastify importer sidecar under PM2: token validation, SSRF-filtered fetch, OG/JSON-LD extraction, normalized response. Frontend gains a paste-a-link quick-add that lands on the save form pre-filled with title, image, and description for Cece to confirm and enrich. Deliverable: link in, cute pre-filled form out.

### Phase 4 — Sharing and shine

Visibility toggles, a friends view for browsing shared patterns and finished objects, empty states and micro-animations, PWA manifest and icons, and a mobile performance pass. Deliverable: the friend group joins.

### Phase 5 — Stretch (unordered, optional)

Ravelry enrichment through the sidecar (server-side Basic Auth key, aggressive caching, self-throttled to a couple of requests per second since no limits are published); ~~Android share-target via the PWA~~ (iOS doesn't support share targets, so the paste flow remains the universal path); a desktop browser extension on the recipe-clipper model; offline-tolerant counters; a yarn stash; public share links.

## 7. Open items

The name "Stitches" is approved — ~~worth noting it shares a name with a certain blue Disney alien, which is either an SEO problem~~ (note: changed to match the animal crossing character) or extremely on-brand for a cute app, depending on taste. ~~Cece's phone OS is worth confirming before Phase 5, since it decides whether the share target is even possible~~. And the final subdomain choice is Zara's call at Phase 0. (Note: It should be stitches, on my zalibhai domain.)

Note: Cece has an iPhone, everyone I know hates Android so that requirement will need to adjusted.

---

todo: token palette and the exact daisyUI theme values 