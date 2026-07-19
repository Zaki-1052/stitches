// scripts/verify/importer-check.mjs — permanent SPEC §10 regression test (PLAN Session 3.1).
// Proves the importer's contract against a RUNNING importer + PocketBase: auth (401), body
// shape (400), the SSRF guard (403 for loopback/RFC 1918/link-local/IPv6/mapped/DNS-resolved
// private targets), caps and content-type (422), a real extraction (200 + contract shape),
// Ravelry enrichment + search (RAVELRY.md R1/R2), and the per-user rate limit (429, exercised
// as user 2 so user 1's budget stays clean).
//
// Cases that need the internet are labeled [net] — every other case runs offline.
//
// BUDGET NOTE: user 1's requests total 18-19 of the 40/min rate limit — comfortable headroom
// since the R2 bump (was 20/min; DECISIONS 2026-07-19). If the limit or the case count ever
// changes, re-check this arithmetic before the suite starts flaking on its own 429s.
//
// Env: PB_URL (default http://127.0.0.1:8090), IMPORTER_URL (default http://127.0.0.1:8095),
//      SEED_USER1_EMAIL/PASSWORD, SEED_USER2_EMAIL/PASSWORD,
//      EXTRACT_TEST_URL (optional override for the real-page extraction case).
// Run: npm run verify:importer   (npm run dev must be up)
import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const IMPORTER_URL = process.env.IMPORTER_URL || 'http://127.0.0.1:8095'
const EXTRACT_TEST_URL = process.env.EXTRACT_TEST_URL || 'https://github.blog/'
const CONTRACT_KEYS = ['source_url', 'canonical_url', 'title', 'description', 'image', 'site_name', 'author']

// The Ravelry happy-path pattern and its known values (live-verified 2026-07-17, fixture at
// scripts/.cache/ravelry-crochet.json). URL and expectations are one unit — no env override.
const RAVELRY_TEST = {
  url: 'https://www.ravelry.com/patterns/library/the-web-of-lies-square',
  pattern_id: 7542093,
  craft: 'crochet',
  hook_mm: 4.5,
  yarn_weight: 'cyc_3', // Ravelry "DK"
  free: true,
}

const required = {
  SEED_USER1_EMAIL: process.env.SEED_USER1_EMAIL,
  SEED_USER1_PASSWORD: process.env.SEED_USER1_PASSWORD,
  SEED_USER2_EMAIL: process.env.SEED_USER2_EMAIL,
  SEED_USER2_PASSWORD: process.env.SEED_USER2_PASSWORD,
}

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length) {
  console.error('importer-check: missing required env vars:')
  for (const key of missing) console.error(`  - ${key}`)
  process.exit(1)
}

let passed = 0
let failed = 0

function pass(label) {
  passed += 1
  console.log(`PASS  ${label}`)
}

function fail(label, detail) {
  failed += 1
  console.error(`FAIL  ${label}`)
  console.error(`      ${detail}`)
}

// One POST against the importer; status 0 means the importer itself was unreachable.
async function post(path, { token, body, raw = false } = {}) {
  try {
    const res = await fetch(`${IMPORTER_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: token } : {}),
      },
      body: JSON.stringify(body ?? {}),
    })
    if (raw) {
      const bytes = await res.arrayBuffer()
      return { status: res.status, contentType: res.headers.get('content-type') ?? '', bytes }
    }
    let payload = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
    return { status: res.status, payload }
  } catch (err) {
    return { status: 0, payload: String(err) }
  }
}

async function expectStatus(label, expected, request) {
  const res = await post(...request)
  if (res.status === expected) pass(label)
  else fail(label, `expected ${expected}, got ${res.status} body=${JSON.stringify(res.payload ?? null)}`)
  return res
}

// ---------------------------------------------------------------------------
// personas — real PB tokens, no superuser (the importer holds no admin creds either)
// ---------------------------------------------------------------------------

const a = new PocketBase(PB_URL)
const b = new PocketBase(PB_URL)
try {
  await a.collection('users').authWithPassword(required.SEED_USER1_EMAIL, required.SEED_USER1_PASSWORD)
  await b.collection('users').authWithPassword(required.SEED_USER2_EMAIL, required.SEED_USER2_PASSWORD)
} catch (err) {
  console.error(`importer-check: user auth failed at ${PB_URL} — is PocketBase running and are the`)
  console.error('SEED_USER1_/SEED_USER2_ credentials correct?')
  console.error(String(err))
  process.exit(1)
}
const tokenA = a.authStore.token
const tokenB = b.authStore.token

console.log(`importer-check: ${IMPORTER_URL} (PB at ${PB_URL})`)

// Preflight: any response at all proves the importer is up (no token → 401 by contract).
{
  const res = await post('/import/extract', { body: { url: 'https://example.com/' } })
  if (res.status === 0) {
    console.error(`importer-check: could not reach the importer at ${IMPORTER_URL} — is npm run dev up?`)
    console.error(String(res.payload))
    process.exit(1)
  }
}

console.log('\n--- auth: 401 without a valid token ---')
await expectStatus('no token → 401', 401, ['/import/extract', { body: { url: 'https://example.com/' } }])
await expectStatus('garbage token → 401', 401, [
  '/import/extract',
  { token: 'not-a-real-token', body: { url: 'https://example.com/' } },
])

console.log('\n--- body shape & URL parsing: 400 ---')
await expectStatus('empty body {} → 400', 400, ['/import/extract', { token: tokenA }])
await expectStatus('unparseable url → 400', 400, ['/import/extract', { token: tokenA, body: { url: 'not a url' } }])
await expectStatus('ftp scheme → 400', 400, ['/import/extract', { token: tokenA, body: { url: 'ftp://example.com/x' } }])

console.log('\n--- SSRF guard: 403 for private/reserved targets (offline cases) ---')
await expectStatus('loopback (PocketBase itself) → 403', 403, [
  '/import/extract',
  { token: tokenA, body: { url: 'http://127.0.0.1:8090/' } },
])
await expectStatus('RFC 1918 target → 403', 403, ['/import/extract', { token: tokenA, body: { url: 'http://192.168.1.1/' } }])
await expectStatus('link-local metadata IP → 403', 403, [
  '/import/extract',
  { token: tokenA, body: { url: 'http://169.254.169.254/latest/meta-data/' } },
])
await expectStatus('IPv6 loopback literal → 403', 403, ['/import/extract', { token: tokenA, body: { url: 'http://[::1]:8090/' } }])
await expectStatus('IPv4-mapped IPv6 loopback → 403', 403, [
  '/import/extract',
  { token: tokenA, body: { url: 'http://[::ffff:127.0.0.1]/' } },
])
await expectStatus('/import/image guards the same pipeline → 403', 403, [
  '/import/image',
  { token: tokenA, body: { url: 'http://192.168.1.1/x.png' } },
])

console.log('\n--- SSRF guard + caps, network-dependent cases ---')
await expectStatus('[net] public hostname resolving private (localtest.me → 127.0.0.1) → 403', 403, [
  '/import/extract',
  { token: tokenA, body: { url: 'http://localtest.me/' } },
])
// httpbin.org 5xxs under load (seen live 2026-07-19: its 503 surfaced as our 422) — fall over
// to the nghttp2 mirror so a helper outage doesn't read as a guard regression. A real guard
// break can't match the helper-down pattern: it would 200 (a LAN router's page) or 422 with
// "Could not reach 192.168.1.1.", never "The site responded with 5xx."
{
  const label = '[net] redirect chain ending private (redirect helper → 192.168.1.1) → 403'
  const helpers = [
    'https://httpbin.org/redirect-to?url=http%3A%2F%2F192.168.1.1%2F',
    'https://nghttp2.org/httpbin/redirect-to?url=http%3A%2F%2F192.168.1.1%2F',
  ]
  let settled = false
  let last = null
  for (const url of helpers) {
    last = await post('/import/extract', { token: tokenA, body: { url } })
    const helperDown = last.status === 422 && /responded with 5\d\d/.test(last.payload?.message ?? '')
    if (helperDown) continue // the helper died before redirecting — try the mirror
    if (last.status === 403) pass(label)
    else fail(label, `expected 403, got ${last.status} body=${JSON.stringify(last.payload ?? null)}`)
    settled = true
    break
  }
  if (!settled) fail(label, `every redirect helper was down — last body=${JSON.stringify(last?.payload ?? null)}`)
}
await expectStatus('[net] not-HTML (a PNG) → 422', 422, [
  '/import/extract',
  { token: tokenA, body: { url: 'https://github.com/fluidicon.png' } },
])
await expectStatus('[net] >3 MB page (single-page WHATWG spec) → 422', 422, [
  '/import/extract',
  { token: tokenA, body: { url: 'https://html.spec.whatwg.org/' } },
])

console.log('\n--- extraction: 200 + the SPEC §10 contract shape ---')
{
  const res = await expectStatus(`[net] real page (${EXTRACT_TEST_URL}) → 200`, 200, [
    '/import/extract',
    { token: tokenA, body: { url: EXTRACT_TEST_URL } },
  ])
  if (res.status === 200 && res.payload) {
    const keys = Object.keys(res.payload)
    const missingKeys = CONTRACT_KEYS.filter((key) => !keys.includes(key))
    const extraKeys = keys.filter((key) => !CONTRACT_KEYS.includes(key))
    if (missingKeys.length === 0 && extraKeys.length === 0) pass('[net] response has exactly the contract keys')
    else fail('[net] response has exactly the contract keys', `missing=[${missingKeys}] extra=[${extraKeys}]`)
    if (res.payload.source_url === EXTRACT_TEST_URL) pass('[net] source_url echoes the requested URL')
    else fail('[net] source_url echoes the requested URL', `got ${res.payload.source_url}`)
    if (res.payload.title) pass('[net] title extracted (page has one)')
    else fail('[net] title extracted (page has one)', 'title came back null')

    if (res.payload.image) {
      const img = await post('/import/image', { token: tokenA, body: { url: res.payload.image }, raw: true })
      if (img.status === 200 && img.contentType.startsWith('image/') && img.bytes.byteLength > 0) {
        pass(`[net] its og:image through /import/image → 200 ${img.contentType} (${img.bytes.byteLength} bytes)`)
      } else {
        fail('[net] its og:image through /import/image → 200 image/*', `status=${img.status} type=${img.contentType}`)
      }
    } else {
      fail('[net] its og:image through /import/image → 200 image/*', 'no image in the extract response to fetch')
    }
  }
}

console.log('\n--- ravelry: enrichment + search (RAVELRY.md §4–§5) ---')
{
  const res = await expectStatus(`[net] ravelry crochet pattern → 200`, 200, [
    '/import/extract',
    { token: tokenA, body: { url: RAVELRY_TEST.url } },
  ])
  if (res.status === 200 && res.payload) {
    const r = res.payload.ravelry
    if (r?.pattern_id === RAVELRY_TEST.pattern_id) pass('[net] ravelry.pattern_id matches')
    else fail('[net] ravelry.pattern_id matches', `ravelry=${JSON.stringify(r ?? null)}`)
    if (r?.craft === RAVELRY_TEST.craft) pass('[net] ravelry.craft mapped to crochet')
    else fail('[net] ravelry.craft mapped to crochet', `got ${r?.craft}`)
    if (r?.hook_mm === RAVELRY_TEST.hook_mm) pass('[net] ravelry.hook_mm from the crochet needle size')
    else fail('[net] ravelry.hook_mm from the crochet needle size', `got ${r?.hook_mm}`)
    if (r?.yarn_weight === RAVELRY_TEST.yarn_weight) pass('[net] ravelry.yarn_weight DK → cyc_3')
    else fail('[net] ravelry.yarn_weight DK → cyc_3', `got ${r?.yarn_weight}`)
    if (r?.free === RAVELRY_TEST.free) pass('[net] ravelry.free carried through')
    else fail('[net] ravelry.free carried through', `got ${r?.free}`)
    // difficulty stays unset on this pattern (difficulty_count is null in the wild) — the
    // falsy-count rule, not a mapping gap.
    if (r?.difficulty === null) pass('[net] ravelry.difficulty unset (rating count is null)')
    else fail('[net] ravelry.difficulty unset (rating count is null)', `got ${r?.difficulty}`)
    // site_name must stay null so the client chip falls back to "ravelry.com" (RAVELRY.md §4.3).
    if (res.payload.site_name === null) pass('[net] site_name null (chip reads ravelry.com)')
    else fail('[net] site_name null (chip reads ravelry.com)', `got ${res.payload.site_name}`)
  }

  // Unknown permalink: the API 404s → logged fall-through to the OG scrape → ravelry.com
  // hard-404s the page too (checked live 2026-07-19) → guardedFetch's non-2xx rule → 422.
  // Proves the branch degrades to exactly the pre-Ravelry pipeline instead of erroring.
  const garbage = await expectStatus('[net] garbage permalink → falls through to OG path → 422', 422, [
    '/import/extract',
    { token: tokenA, body: { url: 'https://www.ravelry.com/patterns/library/garbage-permalink-zzz-000' } },
  ])
  if (garbage.status === 422 && garbage.payload?.error === 'fetch_failed') {
    pass('[net] fall-through surfaces the standard fetch_failed code')
  } else if (garbage.status === 422) {
    fail('[net] fall-through surfaces the standard fetch_failed code', `error=${garbage.payload?.error}`)
  }

  const search = await expectStatus('[net] ravelry search "granny square" → 200', 200, [
    '/import/ravelry/search',
    { token: tokenA, body: { query: 'granny square' } },
  ])
  if (search.status === 200 && search.payload) {
    const item = search.payload.results?.[0]
    const shapeOk =
      item &&
      typeof item.pattern_id === 'number' &&
      typeof item.permalink === 'string' &&
      'name' in item &&
      'designer' in item &&
      typeof item.free === 'boolean' &&
      item.photo &&
      'square' in item.photo &&
      'small' in item.photo
    if (shapeOk) pass('[net] search results have the §5.1 card shape')
    else fail('[net] search results have the §5.1 card shape', `first=${JSON.stringify(item ?? null)}`)
    if (search.payload.paginator?.page === 1) pass('[net] search paginator starts at page 1')
    else fail('[net] search paginator starts at page 1', `paginator=${JSON.stringify(search.payload.paginator ?? null)}`)
  }
}

console.log('\n--- rate limit: 40/min per user (as user 2, so user 1 keeps a clean budget) ---')
{
  let saw429 = false
  let requests = 0
  for (let i = 0; i < 41; i += 1) {
    requests += 1
    const res = await post('/import/extract', { token: tokenB, body: { url: 'http://192.168.1.1/' } })
    if (res.status === 429) {
      saw429 = true
      break
    }
    if (res.status !== 403) {
      fail('burst as user 2 → eventually 429', `request ${requests} got unexpected ${res.status}`)
      saw429 = null
      break
    }
  }
  if (saw429 === true) pass(`burst as user 2 → 429 after ${requests} requests`)
  else if (saw429 === false) fail('burst as user 2 → eventually 429', '41 requests, no 429')
}

console.log(`\nimporter-check: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
