# p09 — Session 3.1: Importer sidecar (SPEC §10 to the letter)

> On approval, first act: copy this plan into `logs/p09-session-3.1-importer-plan.md` (repo
> convention — Zara audits markdown in her editor; sidecars are invisible there).

## Context

Phase 2 is code-complete (2.3 shipped Home + Settings; acceptance boxes await Zara's phase
walk). Session 3.1 builds the **Fastify importer sidecar** — the one component that fetches
arbitrary URLs, so it carries the full SSRF pipeline. Today `importer/` is an empty workspace
stub (`package.json` only), `web/vite.config.ts` already proxies `/import → 127.0.0.1:8095`,
and `scripts/dev.sh` starts only PB + Vite. No UI this session (paste-a-link door is 3.2); no
schema/rules/seed changes (regression gate: `verify:rules` not required).

**Zara's picks (AskUserQuestion, this plan):**
1. **Pin connections** — guarded fetch dials exactly the validated IPs (explicit `undici`
   dep; Node's global fetch can't take a custom dispatcher — verified: `node:undici` doesn't
   exist and the global fetch's internal undici is not injectable). Closes the
   DNS-rebinding/TOCTOU gap. DECISIONS line (deviates from SPEC §5 "Node's global fetch").
2. **tsx watch** for the dev runner (prod path is always the esbuild bundle).
3. **`verify:importer`** checked in as a permanent regression script (rules-check pattern).

**Facts verified (not guessed):**
- PB auth-refresh is **POST** `/api/collections/users/auth-refresh` (SPEC §10 says GET — a
  spec typo; PB docs + installed SDK 0.27.0 confirm POST). Response: `{ token, record }`.
- OGS v6 supports `{ html }` input (must NOT pass `url` alongside); `ogImage` is always an
  array of `{url,...}` objects; OGS never resolves relative URLs (raw meta content verbatim).
- `@fastify/rate-limit` 10.3.0 is built against fastify ^5 and supports
  `hook: 'onRequest'` + custom `keyGenerator` reading request decorations.
- Fastify 5 `decorateRequest` requires primitive defaults (`''`, not objects).
- ipaddr.js 2.4.0: `parse(ip).range()`; IPv4-mapped IPv6 reports `'ipv4Mapped'` (never
  `'unicast'`) — must unwrap via `toIPv4Address()` and re-check, else `[::ffff:127.0.0.1]`
  handling is wrong-by-accident.
- esbuild ESM bundling of fastify's CJS graph emits a `__require` shim → a
  `createRequire` **banner is required** in `dist/server.mjs`.
- WHATWG URL: `hostname` keeps IPv6 brackets (`[::1]`) and canonicalizes
  `[::ffff:127.0.0.1]` → `[::ffff:7f00:1]`.

**Version pins (registry-checked 2026-07-13; policy: AI-known majors, exact pins):**

| Package | Pin | Note |
|---|---|---|
| fastify | 5.10.0 | known major 5 |
| @fastify/rate-limit | 10.3.0 | **held** — 11.x is post-knowledge (2026-06); 10.x targets fastify ^5 |
| open-graph-scraper | 6.12.0 | SPEC pins ^6; latest of known major (lucide precedent) |
| ipaddr.js | 2.4.0 | known major 2 |
| undici | 7.28.0 | **held** — 8.x post-knowledge; matches OGS's `^7.28.0` → dedupes |
| esbuild (dev) | 0.25.12 | **held** — 0.26+ post-knowledge (esbuild minors are breaking) |
| tsx (dev) | 4.23.1 | known major 4; dev-only |

TypeScript 5.9.3 + @types/node 24.13.3 already hoisted at root — not re-declared.

---

## Files to create

```
importer/
├── package.json            # deps above + scripts: dev / build / typecheck
├── tsconfig.json           # strict, noEmit, module nodenext? no — see below
├── build.mjs               # esbuild JS-API build → dist/server.mjs
└── src/
    ├── server.ts           # entry: buildApp() → listen({ host: '127.0.0.1', port })
    ├── app.ts              # buildApp(): plugins/hooks/routes/error handler; no listen (inject-testable)
    ├── config.ts           # env (PORT=8095, PB_URL=http://127.0.0.1:8090) + every SPEC constant
    ├── errors.ts           # HttpError + badRequest/unauthorized/forbidden/unprocessable
    ├── auth.ts             # verifyToken() vs PB POST auth-refresh + 5-min positive cache; authHook
    ├── net/
    │   ├── parseTargetUrl.ts  # parse; http/https only; strip user:pass → URL (throws 400)
    │   ├── ipGuard.ts         # assertPublicAddress (unicast-only, ipv4Mapped unwrap) + resolveTarget
    │   └── guardedFetch.ts    # the §10 pipeline: per-hop guard × pinned dial × 8s total × byte cap
    ├── extract/normalize.ts   # OGS result → contract JSON (relative URL resolution vs finalUrl)
    └── routes/
        ├── extract.ts      # POST /import/extract
        └── image.ts        # POST /import/image
scripts/verify/importer-check.mjs   # regression suite (below)
```

Constants in `config.ts` (single source): `TOKEN_CACHE_TTL_MS=300_000`, `RATE_LIMIT_MAX=20`
per `'1 minute'`, `FETCH_TIMEOUT_MS=8_000`, `MAX_REDIRECTS=3`, `HTML_MAX_BYTES=3_000_000`,
`IMAGE_MAX_BYTES=10_000_000`, `PB_TIMEOUT_MS=5_000`,
`USER_AGENT='StitchesImporter/1.0 (+https://github.com/Zaki-1052/stitches)'`.

## Fastify wiring (`app.ts`)

- Logger: built-in pino, plain JSON → stdout (PM2 captures later), **no transports** (worker
  threads break single-file bundles), `redact: ['req.headers.authorization']`.
- Small `bodyLimit` (8 KB) — bodies are `{url}` only.
- Everything registers inside one `{ prefix: '/import' }` encapsulated child scope:
  1. `decorateRequest('userId', '')` + `onRequest` **authHook** (missing/bad token → 401).
  2. `@fastify/rate-limit` with `hook: 'onRequest'`, `max: 20`, `timeWindow: '1 minute'`,
     `keyGenerator: (req) => req.userId`. Registered *after* the auth hook — same-phase hooks
     run in registration order, so the key is always populated. Deliberate deviation from the
     README's `preHandler` example: at `preHandler`, malformed-body 400s would never count
     against the limit. Prove ordering with an `app.inject()` check during implementation.
  3. Routes with a shared body schema `{ url: string, minLength 1, maxLength 2048,
     additionalProperties false }` (ajv 400 for shape; `parseTargetUrl` 400 for semantics).
- One `setErrorHandler`: `HttpError` → its status + `{ error, message }`; ajv validation →
  400 `invalid_body`; rate-limit's 429 passes through in the same envelope; anything else →
  log error, 500 `internal_error` (no internals leaked).

| Status | Thrown by |
|---|---|
| 400 | ajv body schema · `parseTargetUrl` (bad scheme/unparseable) |
| 401 | authHook (missing/invalid token; PB unreachable — see below) |
| 403 | `ipGuard` per hop (private/reserved target) |
| 422 | `guardedFetch` (non-2xx, wrong/missing content-type, byte cap, timeout, >3 redirects, missing Location, DNS NXDOMAIN) · `normalize` (OGS threw) |
| 429 | @fastify/rate-limit |

## Auth (`auth.ts`)

`verifyToken(token)` → POST `${PB_URL}/api/collections/users/auth-refresh` with
`Authorization: <token>`, own 5 s timeout (independent of the fetch budget) → `record.id`.
In-memory `Map<token, { userId, expiresAt }>`: **cache successes only** (a negative cache
would lock a fresh login out for 5 min), lazy eviction on read, cap ~500 entries. The
importer holds no admin credentials. **PB unreachable → 401** (contract has no 5xx; "cannot
confirm your token" is the honest closest code) with a distinguishable log event
(`pb_unreachable` vs `token_invalid`) → DECISIONS line.

## Guarded fetch (`net/guardedFetch.ts`) — the SSRF contract

```ts
guardedFetch(target: URL, opts: { accept: 'text/html' | 'image/*', maxBytes: number })
  → { finalUrl: URL, contentType: string, body: Buffer }
```

One `AbortController` + one `setTimeout(8_000)` created **before** the hop loop (total
budget, never reset per hop; cleared in `finally`). Loop ≤ `MAX_REDIRECTS + 1`:

1. Re-run scheme allow-list + credential-strip on **every** hop (a redirect to `file:`/
   `data:` must die even though hop 1 was https).
2. Resolve target: IP literal (strip `[]`, `ipaddr.isValid`) → validate directly; hostname →
   `dns.promises.lookup(host, { all: true })`, **every** A+AAAA address must pass
   `assertPublicAddress` (unicast-only; unwrap ipv4Mapped and re-check the inner IPv4).
   Any failure → 403. NXDOMAIN/DNS error → 422.
3. **Pinned dial:** `undici.fetch(url, { dispatcher, redirect: 'manual', signal, headers:
   { 'user-agent': UA, accept } })` where `dispatcher = new Agent({ connect: { lookup:
   (h, o, cb) => cb(null, validatedAddress, family) } })` — the lookup hands back only the
   address(es) step 2 validated, so checked IP ≡ dialed IP (rebinding closed). Hostname
   still flows to TLS, so SNI/cert validation is untouched. One Agent per hop, closed in
   `finally`. IP-literal targets can dial plainly (nothing to rebind).
4. 3xx → read `Location` (missing → 422), resolve relative to *this hop's* URL
   (`new URL(loc, current)`), cancel the 3xx body, loop. Budget exhausted → 422.
5. Terminal: require 2xx → else 422. Content-type: strip `;charset=…`, trim, lowercase;
   **missing header → 422**; `text/html` prefix or `image/` prefix per `accept`. Never trust
   Content-Length — stream via `response.body.getReader()`, abort + 422 the byte the sum
   exceeds `maxBytes`.

`assertPublicAddress` (unicast-only) is deliberately **stricter** than SPEC §10's enumerated
list — it also rejects unspecified/broadcast/multicast/reserved/uniqueLocal etc. DECISIONS
line ("allow-only-unicast supersedes the deny-list").

## Routes

**`POST /import/extract`** → `parseTargetUrl` → `guardedFetch(…, 'text/html', 3 MB)` →
decode to string → `ogs({ html })` (OGS never fetches; all network stayed in the pipeline) →
`normalize`:
- `source_url` = requested URL post-credential-strip (pre-redirect); `canonical_url` =
  `ogUrl ?? finalUrl` — the source/canonical split is an interpretation → DECISIONS line.
- `title ← ogTitle` · `description ← ogDescription` · `site_name ← ogSiteName` ·
  `author ← result.author ?? null` (plain meta author; don't conflate `articleAuthor`).
- `image ← ogImage?.[0]?.url` resolved against **finalUrl** (`new URL(candidate, finalUrl)`,
  catch → null) — OGS returns raw meta content verbatim.
- All fields nullable except `source_url`. OGS throw → 422.

**`POST /import/image`** → same pipeline with `image/*`, 10 MB → buffer →
`reply.type(contentType).send(body)`. (Buffering, not streaming: cap must be enforced
anyway, ≤10 MB fits a 4-user app, and errors stay clean JSON.)

## Build (`build.mjs`) + dev wiring

esbuild JS API: `bundle: true, platform: 'node', format: 'esm', target: 'node24',
outfile: 'dist/server.mjs'`, with the **createRequire banner** (`createRequire`,
`__filename`, `__dirname`) — required, not defensive: fastify's CJS graph leaves a
`typeof require` shim in ESM output. Review build warnings; expect only pino's optional
pretty-transport probes and OGS's unused `iconv-lite` (verified dead in `{html}` mode;
`chardet` *is* exercised — covered by the smoke test).

- `importer/package.json` scripts: `dev: tsx watch src/server.ts` ·
  `build: node build.mjs` · `typecheck: tsc -p tsconfig.json`.
- `importer/tsconfig.json`: strict, `noEmit`, `target es2023`, `module esnext` +
  `moduleResolution bundler` (both consumers — tsx and esbuild — resolve the bundler way),
  `verbatimModuleSyntax`, `types: ["node"]`, unused-checks on (mirrors web's strictness).
- `scripts/dev.sh`: after the PB line —
  `( cd "$ROOT/importer" && PORT=8095 PB_URL=http://127.0.0.1:8090 npx tsx watch src/server.ts ) & IMPORTER_PID=$!`
  and extend the trap to kill both PIDs. No readiness gate (PB has none either; a brief
  proxy 502 window at boot is existing precedent).
- Root `package.json`: add `"verify:importer": "node --env-file-if-exists=.env
  scripts/verify/importer-check.mjs"`.
- `.env.example`: no additions (verify script reuses SEED_USER creds + optional PB_URL;
  importer port stays hardcoded like PB's).
- Version bump: `web/package.json` → **0.3.1** (phase.session convention).
- Vite proxy: already done (0-line change).

## `scripts/verify/importer-check.mjs` (rules-check conventions: plain node, .env auto-load, cleans nothing — it creates nothing)

Logs in as SEED_USER1 against PB for a real token, then against `http://127.0.0.1:8095`:

- **Local (always run):** no token → 401 · garbage token → 401 · `{}` body → 400 ·
  `url:"notaurl"` → 400 · `ftp://…` → 400 · `http://127.0.0.1:8090` → 403 ·
  `http://192.168.1.1` → 403 · `http://169.254.169.254` → 403 · `http://[::1]:8090` → 403 ·
  `http://[::ffff:127.0.0.1]/` → 403 · `http://localtest.me` (public DNS → 127.0.0.1) → 403.
- **Network-dependent (labeled in output):** `https://httpbin.org/redirect-to?url=
  http://192.168.1.1` → 403 (redirect chain ending private) · a PNG URL → 422 (not HTML) ·
  `https://html.spec.whatwg.org/` → 422 (>3 MB page) · a real crochet-blog URL → 200 +
  contract-shape assert (all keys present, `source_url` echoed) · its `og:image` through
  `/import/image` → 200 + `image/*` content-type.
- **429:** logs in as SEED_USER2 (separate rate-limit key so functional cases keep user1's
  budget) and bursts 21 blocked-target requests → expects ≥1 429.

Summary table + non-zero exit on any failure — later runnable against prod (5.1), like
rules-check.

## Commands to hand Zara (she runs; literal)

```
npm install --workspace importer --save-exact fastify@5.10.0 @fastify/rate-limit@10.3.0 open-graph-scraper@6.12.0 ipaddr.js@2.4.0 undici@7.28.0
npm install --workspace importer --save-exact --save-dev esbuild@0.25.12 tsx@4.23.1
```

Then after the build lands: `npm run dev` (now boots PB + importer + Vite) and
`npm run verify:importer 2>&1 | tee logs/importer-check-3.1.txt`.

## Verification

- **Claude runs:** `npm run typecheck --workspace importer` · `npm run lint` (web untouched
  but cheap) · `npm run build --workspace importer` · a no-port smoke via `app.inject()`
  (script in scratchpad): 401 without token (no PB needed), 400 on bad body, and a direct
  `normalize`/OGS `{html}` call proving cheerio+chardet execute — plus the same inject smoke
  against the **built bundle** to prove the banner + CJS graph load
  (`node -e` importing `dist/server.mjs` is fine — import only, no `.listen()`).
- **Zara runs:** `npm run dev`, then `npm run verify:importer` (all local cases green;
  network cases green while online) — this covers every PLAN 3.1 acceptance box:
  - [ ] Block tests all 403: `http://127.0.0.1:8090`, RFC 1918, `169.254.169.254`, redirect
        chain ending private
  - [ ] No/bad token → 401 · >3 MB page → 422 · real blog URL → contract JSON
- Boxes in `docs/PLAN.md` stay **unticked** until Zara confirms (memory: acceptance is
  batched per phase; 3.1 has no 📱 marks — everything is curl-able).

## DECISIONS.md lines to append (draft, one each)

1. Importer fetches via explicit `undici@7.28.0` (fetch + per-hop Agent whose
   `connect.lookup` returns only the pre-validated addresses) · closes the SPEC §10
   TOCTOU/rebinding gap; Node's global fetch accepts no dispatcher; Zara's pick with p09.
2. PB token validation is **POST** auth-refresh · SPEC §10 says GET; PB v0.39 API and SDK
   0.27.0 are POST.
3. Held majors: @fastify/rate-limit 10.3.0 (not 11.x), esbuild 0.25.12 (not 0.26+),
   undici 7.28.0 (not 8.x) · post-knowledge majors per version policy; tsx 4.23.1 dev-only
   runner (Zara's pick with p09).
4. SSRF guard is allow-only-`unicast` (ipaddr.js), ipv4-mapped addresses unwrapped and
   re-checked · stricter than SPEC §10's enumerated deny-list.
5. Rate limiter runs at `onRequest` after the auth hook, keyed by user id · at the README's
   `preHandler`, malformed-body 400s wouldn't count against the limit.
6. PB-unreachable → 401 with a distinct `pb_unreachable` log event · SPEC's error contract
   has no 5xx; 401 is the honest nearest code.
7. `source_url` = requested URL (credential-stripped), `canonical_url` = `ogUrl` ?? final
   post-redirect URL · SPEC's normalize step doesn't define the split.
8. `scripts/verify/importer-check.mjs` + `npm run verify:importer` added as the permanent
   3.1 regression (rules-check pattern); network-dependent cases labeled · Zara's pick
   with p09.

## Wrap-up

- Session log `logs/2026-07-13_session-3.1-importer.md` (40–60 lines, house format).
- Out of scope, deliberately: paste-a-link UI + `/patterns/new?url=` prefill (3.2), PM2
  ecosystem + deploy (5.1), Ravelry enrichment (Phase 6). Importer stays a sidecar the web
  app doesn't call yet.
