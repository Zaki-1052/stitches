// scripts/verify/importer-check.mjs — permanent SPEC §10 regression test (PLAN Session 3.1).
// Proves the importer's contract against a RUNNING importer + PocketBase: auth (401), body
// shape (400), the SSRF guard (403 for loopback/RFC 1918/link-local/IPv6/mapped/DNS-resolved
// private targets), caps and content-type (422), a real extraction (200 + contract shape),
// and the per-user rate limit (429, exercised as user 2 so user 1's budget stays clean).
//
// Cases that need the internet are labeled [net] — every other case runs offline.
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
await expectStatus('[net] redirect chain ending private (httpbin.org → 192.168.1.1) → 403', 403, [
  '/import/extract',
  { token: tokenA, body: { url: 'https://httpbin.org/redirect-to?url=http%3A%2F%2F192.168.1.1%2F' } },
])
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

console.log('\n--- rate limit: 20/min per user (as user 2, so user 1 keeps a clean budget) ---')
{
  let saw429 = false
  let requests = 0
  for (let i = 0; i < 21; i += 1) {
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
  else if (saw429 === false) fail('burst as user 2 → eventually 429', '21 requests, no 429')
}

console.log(`\nimporter-check: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
