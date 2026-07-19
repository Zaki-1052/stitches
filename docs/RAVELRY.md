# RAVELRY.md — Ravelry API Integration Spec

*Version 1.0 · July 2026 · Status: **approved design, not yet built**. Companions: `SPEC.md`
(architecture), `DESIGN.md` (visual system), `docs/ravelry-docs.md` (verbatim API docs dump,
"Last updated 2026-06-18"), `docs/research/ravelry-api-agreement.md` (verbatim license
agreement). Research session: 2026-07-17 (four parallel research tracks + the logged-in doc
captures by Zara).*

---

## 1. What this is

Cece asked for "the Ravelry feature." SPEC §17 parked it in the backlog as "Ravelry enrichment
through the importer (server-side key, aggressive caching, self-throttled)" — this spec pulls it
forward and defines it. Three tiers:

| Tier | Feature | Status |
|---|---|---|
| Core | **Link enrichment** — paste a Ravelry pattern URL, get a form pre-filled with structured metadata the OG scrape can never see (weight, hook, gauge, yardage, difficulty) | Spec'd to buildable depth (§4) |
| Core | **In-app search** — type a query, browse Ravelry results with thumbnails, tap one into the save form | Spec'd to buildable depth (§5) |
| Stretch | **One-time import** of Cece's favorites / queue / library *metadata + thumbnails* | Spec'd (§7); build gated on Cece's saved-count |
| Sketch | **Purchased-PDF vault import** (her bought patterns into `pattern_attachments`) | Sketched only (§8); not planned |

Manual entry remains first-class and never blocked — vintage patterns that exist on neither
Ravelry nor Ribblr are a core Stitches use case, not an afterthought.

## 2. Credentials & app registrations (already exist)

| Credential | Type | Use | Where |
|---|---|---|---|
| `ravelry-basic` | HTTP Basic auth, **read only** | Everything in the core. Can only call API methods *not* marked `authenticated` in the docs — which includes `patterns/search` and `patterns/show`. | Username `read-401ab32b1ea686ddf7ce552a278b9fa6` (non-secret, like a client ID); password in `.env` as `RAVELRY_BASIC` |
| `ravelry-stitches` | OAuth 2.0 app | **Parked.** Needed only for the stretch/sketch tiers (per-user consent, `library-pdf`). Its "set up your redirect URIs" warning stays unresolved until then — nothing in the core uses OAuth. | Client ID `ebaa63e4d5417814af5cb68426e08b5d`; secret not yet stored |

Env contract (importer): `RAVELRY_BASIC_USER` (the username above) + `RAVELRY_BASIC` (the
password). Both live in `.env` / `.env.example`; the importer reads both, hardcodes neither.

API base: `https://api.ravelry.com` · SSL required · JSON envelopes:
single `{"pattern": {…}}`, search `{"paginator": {…}, "patterns": […]}`, batch
`GET /patterns.json?ids=1+2+3` → `{"patterns": {…}}` (≤100 ids per call recommended).

## 3. License posture (from the agreement, read 2026-07-17)

The agreement (v1.0, Nov 2020) is short and lenient. What binds us:

1. **Metadata only, ever.** Pattern instructions/PDFs are never fetched, stored, or displayed
   from any Ravelry endpoint — same line the Stitches vault already draws. (The §8 sketch is the
   sole, owner-consented exception, and it lands in the owner-only vault.)
2. **Storage is permitted** "for as long as is necessary to provide the service" — a thumbnail
   and metadata living in a member's library for the life of the pattern record is exactly that.
   No caching time cap, no hotlink-vs-rehost rule exists in the agreement; the existing
   download-compress-store thumbnail pipeline stays.
3. **Destroy on request** (Ravelry's or the content owner's). Served by §6's provenance fields:
   every Ravelry-sourced record is identifiable and deletable.
4. **Conspicuous disclosure** of how the app collects/stores/uses Ravelry data: one honest,
   on-voice line on the search surface (microcopy drafted at build time; no em-dashes).
5. **No implied endorsement**: Ravelry is presented as a *source* ("imported from ravelry.com"
   chip), never as an affiliation.
6. **No redistribution/syndication**: a 4-person invite-only app is nowhere near this; the
   friends-visibility model shares *records among members*, not API access or bulk data.

## 4. Core feature: link enrichment

### 4.1 Flow

`POST /import/extract` grows one branch. After `parseTargetUrl`:

1. **Match** `www.ravelry.com` / `ravelry.com` URLs with path `/patterns/library/{permalink}`
   (trailing `-N` disambiguators are part of the permalink; query strings ignored).
2. **Fetch** `GET api.ravelry.com/patterns/{permalink}.json` with Basic auth — the permalink
   resolves directly; no search hop, one request per paste.
3. **Normalize** (server-side, §4.2) into the extended contract (§4.3).
4. **Any failure → fall through** to the existing OG-scrape pipeline unchanged. A Ravelry
   outage, 404 (deleted/unknown pattern), or 429 degrades to exactly today's behavior, and
   OG-scrape failure already degrades to a URL-only form. Soft failure all the way down.

Non-library Ravelry URLs (`/projects/…`, store links, `rav.me` short links) are not matched;
they take the OG-scrape path like any other page.

### 4.2 Field mapping (Ravelry `Pattern (full)` → Stitches)

The importer maps to **Stitches vocabulary** before responding; the client stays dumb.

| Stitches | Ravelry source | Transform |
|---|---|---|
| `title` | `name` | direct |
| `designer` | `pattern_author.name` | direct |
| `source_url` | `permalink` | `https://www.ravelry.com/patterns/library/{permalink}` (the object's `url` field is the designer's external site — not this) |
| `source_name` | — | constant `"Ravelry"` |
| `craft` | `craft.permalink` | `crochet`→`crochet`, `knitting`→`knitting`; if any `pattern_attributes[]`/`pattern_categories[]` permalink contains `tunisian` → `tunisian`; anything else → `other` |
| `yarn_weight` | `yarn_weight.name` | name→CYC table below; unknown/absent → unset |
| `hook_mm` | `pattern_needle_sizes[]` | entries with `crochet === true` only (verified live 2026-07-17; `hook` is `null` even on crochet entries — ignore it, and ignore `us`, which is knitting-scale numbering); take `metric` (numeric mm); several hooks → smallest; none → unset |
| `gauge` | `gauge_description` | ready-made freeform string ("26 stitches and 40 rows = 4 inches in stockinette stitch") |
| `yardage`, `yardage_max` | same names | direct ints |
| `difficulty` | `difficulty_average` (float 1–10) + `difficulty_count` | count `0` → unset; else ≤2.0 `beginner`, ≤3.0 `easy`, ≤4.5 `intermediate`, else `experienced` (values cluster 1.5–3 in the wild; thresholds are one constant, tune freely) |
| `notes` | `notes_html` | direct HTML (TipTap value; dompurify already sanitizes on render) |
| thumbnail | `photos[0].medium2_url` | 640 px on the long edge, current docs; falls back `medium_url` → `small2_url`. Fetched via the existing `/import/image` proxy + §8 client pipeline — the CDN (`*.ravelrycache.com`) is public, the SSRF guard passes it like any public host |

Yarn-weight name → CYC (from Ravelry's official chart):
`Thread`/`Cobweb`/`Lace`/`Light Fingering` → `cyc_0` · `Fingering` → `cyc_1` · `Sport` → `cyc_2`
· `DK` → `cyc_3` · `Worsted`/`Aran` → `cyc_4` · `Bulky` → `cyc_5` · `Super Bulky` → `cyc_6` ·
`Jumbo` → `cyc_7`. (`cyc_8` "Jumbo+" has no Ravelry equivalent; unmapped names → unset.)

### 4.3 Extended extract contract

Backward-compatible: the existing seven `ExtractedMetadata` fields keep their exact semantics
(`title`, `description`, `image`, `site_name`, `author` filled from the Ravelry data;
`canonical_url` = the §4.2 `source_url`). One new optional block:

```json
{ "…existing fields…": "…",
  "ravelry": {
    "pattern_id": 899479,
    "craft": "crochet",
    "yarn_weight": "cyc_4",
    "hook_mm": 5.0,
    "gauge": "14 sc × 16 rows = 4 in",
    "yardage": 94, "yardage_max": 264,
    "difficulty": "easy", "difficulty_average": 2.41,
    "notes_html": "<p>…</p>",
    "free": true
  } }
```

All `ravelry.*` fields nullable except `pattern_id`. `usePasteLinkDoor` passes the block to the
save form, which prefills the Details section (weight/hook/gauge/yardage/difficulty), the craft
select, and notes — everything the user could type, pre-typed, still editable. The existing
"imported from {site}" chip renders "imported from ravelry.com" unchanged.

## 5. Core feature: in-app search

### 5.1 Endpoint

`POST /import/ravelry/search` (importer) · body `{ "query": string, "page": number? }` ·
auth + rate limiting identical to the other `/import/*` routes (PB token, 40/min per user).

Proxies `GET api.ravelry.com/patterns/search.json?query=…&page=…&page_size=20&craft=crochet`
(craft filter value live-verified per §9; the docs confirm all on-site search filters work as
query params). Response:

```json
{ "results": [ { "pattern_id": 124400, "name": "…", "permalink": "…",
    "designer": "…", "free": true,
    "photo": { "square": "https://…", "small": "https://…" } } ],
  "paginator": { "page": 1, "page_count": 5, "results": 92 } }
```

Errors map onto the existing importer contract: 400 invalid body · 401 bad token · 422 Ravelry
call failed · 429 rate limited.

### 5.2 UI

A search surface reachable from the quick-add flow: search box → result cards (square thumb,
name, designer, free badge) → tap → the save form opens pre-filled via the §4 enrichment path
(by permalink). Result thumbnails render **directly from Ravelry's CDN** — transient browsing,
nothing stored; only the picked pattern's image enters the pipeline. Paging via "more results".

Open UI decision for the build session (needs Zara + a DECISIONS line): whether Search Ravelry
is a fourth door on Home/➕ or lives inside the Paste-a-link door's screen. DESIGN §9 currently
enumerates three doors. The disclosure line (§3 #4) lands on this surface either way.

## 6. Schema addition (migration)

`patterns` gains two optional fields, provisioned the usual way (`pb_migrations`):

- `ravelry_id` — number. Set by both doors when a pattern originates from Ravelry; the import
  script's idempotency key; the provenance marker §3 #3 relies on.
- `ravelry_fetched_at` — date. When the metadata was pulled; makes any future staleness or
  deletion obligation honorable after the fact.

API rules unchanged (owner-writes, visibility-aware reads). The save form simply carries the
values through; nothing renders them in v1.

## 7. Stretch: one-time import (metadata + thumbnails) — gated

**Gate:** resolved 2026-07-18 — Cece wants the import. (Scale never worried anyone: the math
below holds to thousands of saves.)
**Shape (approved):** a local Node script (`scripts/`, seed-script conventions), with the GDPR
export as fallback. Not an in-app feature; friends don't self-serve.

- **Endpoints:** `favorites/list` (`types=pattern`, ≤100/page; nested `favorited` pattern incl.
  photo URLs, plus Cece's own `comment` + `tag_list`), `queue/list` (carries `pattern_id`,
  `best_photo`), `library/search` (volumes with `pattern_id`, cover images). All marked
  `authenticated` — **the read-only key cannot call them.**
- **Auth (decided 2026-07-18, Zara's call):** Cece creates her *own* "Basic Auth: personal
  account access" key at ravelry.com/pro/developer (prompts to create a free Pro account on
  first visit) and hands both halves to Zara privately → `.env` as `RAVELRY_CECE_USER` /
  `RAVELRY_CECE_KEY`, read **only** by the import script, never by the importer service. A
  personal key authenticates *as Cece* with all permissions (docs: "you do not need to request
  specific permissions"), so the `authenticated`-only list endpoints above work directly,
  private items included — the §9 #5 cross-user question is moot and the OAuth dance is dead.
  The key is full access to her account: shared over a private channel, used for this one job,
  and Cece deletes the app on Ravelry once the import is verified. **Fallback** (if she can't
  or won't make a key): Ravelry's native "export data" (avatar menu → zip; favorites/queue/
  library listing as JSON, private items included, no API at all) and the script parses the
  zip instead.
- **Pipeline:** page through lists → dedupe pattern ids → batch `/patterns.json?ids=` (≤100 per
  call) → create Stitches patterns owned by Cece — shelf mapping (constants, tweakable):
  favorites → `want_to_make` (Ravelry hearts to the coral-heart shelf), queue → `queued`,
  library → `saved` → map her Ravelry `tag_list` onto Stitches tags (created on the fly, colors
  assigned round-robin through the five patches in first-seen order — deterministic, all
  on-palette) → thumbnails through the §4.2 photo pipeline. Idempotent on `ravelry_id` (re-runs
  update, never duplicate). Serialized, ~1 req/s; even 2,000 favorites is ~20 list calls + ~20
  batch calls.
- **Scale check:** 500 favorites ≈ 5 list requests; the whole job stays under ~100 API calls.

## 8. Sketch only: purchased-PDF vault import — not planned

Recorded so the door is mapped, explicitly **not** designed to buildable depth:

Cece's *bought* patterns can land in her copyright vault (`pattern_attachments`, owner-only,
Protected — exactly what the vault exists for). Requires her own interactive OAuth consent with
the `library-pdf` scope: `volumes/{id}.json` → `volume_attachments[]` →
`POST /product_attachments/{id}/generate_download_link.json` → short-lived signed URL → download
→ vault upload. Hard caps from the docs: **100 `generate_download_link` calls per user per day**,
`library-pdf` tokens expire faster than normal and can die on rate-limit; Ravelry suggests
holding a normal token *and* a library-pdf token. Needs redirect URIs on the OAuth app, secret
storage, token handling — the real scope jump. Revisit only if Cece asks for it.

## 9. Live verifications (one smoke-test session, read-only key)

Recorded here so the build session starts by closing them; none block anything in this spec.

1. ✅ VERIFIED 2026-07-17 — the `crochet`/`knitting` booleans exist in current responses and
   are the discriminator; observed on a live crochet pattern:
   `{"id":7,"us":"7.0","metric":4.5,"us_steel":null,"crochet":true,"knitting":false,"hook":null,…}`.
   `hook` is `null` even here (never rely on it); `us` is knitting-scale (ignored).
2. ✅ VERIFIED 2026-07-17 — `craft=crochet` works on `patterns/search.json` (live call returned
   crochet results; search `first_photo` carries `medium2_url` too).
3. ✅ VERIFIED 2026-07-17 — ETag present on live responses (weak validator, `W/"…"`; send it
   back verbatim in `If-None-Match`, quotes and `W/` prefix included).
4. Search `sort` tokens, if a non-default ordering is ever wanted (not needed for v1).
5. MOOT 2026-07-18 — was: whether a personal-access basic key can GET another user's public
   `favorites/list`. §7 now uses Cece's *own* personal key (authenticates as her; no cross-user
   read involved). Replaced by a smoke test of her key (`current_user.json`, then a one-page
   `favorites/list`) before the import's full run.

Live-response notes (2026-07-17 smoke test, pattern 124400): `difficulty_average` confirmed a
low-clustering float (1.595 over 6,099 ratings — the §4.2 buckets are calibrated for this);
`has_uk_terminology`/`has_us_terminology` may be `null`; freeform text fields can carry trailing
whitespace (`"stockinette stitch  "`) — the mapper trims every string.

## 10. Etiquette & ops

- **User-Agent:** `StitchesImporter/1.0 (+repo URL)` on every Ravelry call (existing importer
  convention).
- **Caching:** small in-memory ETag map in the importer (URL → etag + body); send
  `If-None-Match`, serve the cached body on 304. Repeat pastes and re-searches become free.
  (Officially supported per the docs' ETags section.)
- **Throttle:** Ravelry publishes no numeric limit anywhere (research confirmed the null
  result). The per-user 40/min importer limit already bounds the app; Ravelry calls are
  serialized per request anyway. Honor any `429`'s `Retry-After`. The import script self-caps
  at ~1 req/s.
- **Failure honesty:** Ravelry HTTP status and body logged on every non-200 (existing importer
  logging conventions); no silent fallbacks — the §4.1 fall-through logs why it fell through.
- **Prod:** nothing new. The importer already runs on the VPS behind Nginx `/import/`;
  `RAVELRY_BASIC*` joins its env. No new ports, no client-side keys, no CORS.

## 11. Suggested build sessions (for PLAN.md when scheduled)

- **R1 — Importer enrichment:** §9 verifications, Ravelry client module + mapping in the
  importer, §4 extract branch, §6 migration, form prefill wiring, verify-script extension
  (`importer-check.mjs` gains `[net]` Ravelry cases). Regression gate: `verify:importer` +
  `verify:rules` green.
- **R2 — Search door:** §5 endpoint + search UI + disclosure microcopy + DECISIONS line for the
  door placement. 📱 acceptance on device.
- **R3 (gated) — Import script:** §7, after Cece's answer and the §9 #5 check.

Ordering relative to Phase 5 (provision/launch) is Zara's call; everything here is
local-dev-friendly and deploys with the existing `deploy.sh` flow.
