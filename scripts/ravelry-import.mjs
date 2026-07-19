// scripts/ravelry-import.mjs — Cece's one-time Ravelry import (RAVELRY.md §7): favorites +
// queue + library metadata & thumbnails into her Stitches library. Local script, seed.mjs
// conventions: env via `node --env-file-if-exists=.env`, required vars checked up front,
// fails loudly, idempotent (re-runs update on `ravelry_id`, never duplicate).
//
//   npm run ravelry:import:smoke   — current_user + one favorites page, zero writes
//   npm run ravelry:import         — the full import
//
// Auth: RAVELRY_CECE_USER/RAVELRY_CECE_KEY is her *personal-access* basic key (authenticates
// as her, so the authenticated-only list endpoints work); read ONLY by this script, never by
// the importer service. She deletes the key on Ravelry once the import is verified.
// PB writes happen as RAVELRY_IMPORT_OWNER_EMAIL — the account that will own every imported
// pattern — because `patterns.createRule` demands owner = the authed user.
//
// Shelf precedence when a pattern appears in several lists: favorites (want_to_make) > queue
// (queued) > library (saved) — the strongest expressed intent wins. Her favorites' tag_list
// becomes Stitches tags, colors round-robin through the five patches in first-seen order.
// Everything lands private; she can share from the app afterwards.
//
// The field mapping constants are kept in sync by hand with importer/src/ravelry/map.ts (no
// shared package between scripts/ and the importer workspace).
import PocketBase from 'pocketbase'

const RAVELRY_API_BASE = 'https://api.ravelry.com'
const RAVELRY_LIBRARY_BASE = 'https://www.ravelry.com/patterns/library/'
const USER_AGENT = 'StitchesImporter/1.0 (+https://github.com/Zaki-1052/stitches)'
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const PAGE_SIZE = 100
const BATCH_SIZE = 100 // /patterns.json?ids= recommends ≤100 ids per call
const PACE_MS = 1000 // ~1 req/s against the API; CDN thumbnail fetches are not paced

const TAG_COLORS = ['blue', 'coral', 'lilac', 'mint', 'butter']
const YARN_WEIGHT_TO_CYC = {
  Thread: 'cyc_0',
  Cobweb: 'cyc_0',
  Lace: 'cyc_0',
  'Light Fingering': 'cyc_0',
  Fingering: 'cyc_1',
  Sport: 'cyc_2',
  DK: 'cyc_3',
  Worsted: 'cyc_4',
  Aran: 'cyc_4',
  Bulky: 'cyc_5',
  'Super Bulky': 'cyc_6',
  Jumbo: 'cyc_7',
}
const DIFFICULTY_THRESHOLDS = { beginner: 2.0, easy: 3.0, intermediate: 4.5 }

// ---------------------------------------------------------------------------
// Mode + env
// ---------------------------------------------------------------------------

const mode = process.argv[2]
if (mode !== '--smoke' && mode !== '--run') {
  console.error('ravelry-import: pass --smoke (read-only key check) or --run (the import)')
  process.exit(1)
}

const required = {
  RAVELRY_CECE_USER: process.env.RAVELRY_CECE_USER,
  RAVELRY_CECE_KEY: process.env.RAVELRY_CECE_KEY,
  ...(mode === '--run'
    ? {
        RAVELRY_IMPORT_OWNER_EMAIL: process.env.RAVELRY_IMPORT_OWNER_EMAIL,
        RAVELRY_IMPORT_OWNER_PASSWORD: process.env.RAVELRY_IMPORT_OWNER_PASSWORD,
      }
    : {}),
}
const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key)
if (missing.length) {
  console.error('ravelry-import: missing required env vars:')
  for (const key of missing) console.error(`  - ${key}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Ravelry client — basic auth, UA, ~1 req/s, honor a 429's Retry-After once
// ---------------------------------------------------------------------------

const AUTH_HEADER = `Basic ${Buffer.from(
  `${required.RAVELRY_CECE_USER}:${required.RAVELRY_CECE_KEY}`,
).toString('base64')}`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function ravelryGet(pathAndQuery, { retried = false } = {}) {
  await sleep(PACE_MS)
  const res = await fetch(`${RAVELRY_API_BASE}${pathAndQuery}`, {
    headers: { authorization: AUTH_HEADER, 'user-agent': USER_AGENT, accept: 'application/json' },
  })
  if (res.status === 429 && !retried) {
    const retryAfter = Number(res.headers.get('retry-after')) || 10
    console.log(`WAIT  Ravelry sent 429; honoring Retry-After (${retryAfter}s)`)
    await sleep(retryAfter * 1000)
    return ravelryGet(pathAndQuery, { retried: true })
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`FAIL  Ravelry ${res.status} on ${pathAndQuery}`)
    console.error(body.slice(0, 500))
    process.exit(1)
  }
  return res.json()
}

// Page through a list endpoint until the paginator says stop.
async function ravelryPages(buildPath, extract) {
  const items = []
  let page = 1
  for (;;) {
    const data = await ravelryGet(buildPath(page))
    items.push(...extract(data))
    const paginator = data.paginator
    if (!paginator || page >= paginator.page_count) return items
    page += 1
  }
}

// ---------------------------------------------------------------------------
// Field mapping (kept in sync by hand with importer/src/ravelry/map.ts)
// ---------------------------------------------------------------------------

const trimOrNull = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

function mapCraft(pattern) {
  const facets = [...(pattern.pattern_attributes ?? []), ...(pattern.pattern_categories ?? [])]
  if (facets.some((facet) => facet?.permalink?.includes('tunisian'))) return 'tunisian'
  const permalink = pattern.craft?.permalink
  if (permalink === 'crochet' || permalink === 'knitting') return permalink
  return 'other'
}

function mapHookMm(sizes) {
  const metrics = (sizes ?? [])
    .filter((size) => size?.crochet === true)
    .map((size) => size?.metric)
    .filter((metric) => typeof metric === 'number' && Number.isFinite(metric))
  return metrics.length ? Math.min(...metrics) : null
}

function mapDifficulty(average, count) {
  if (!count || typeof average !== 'number') return null
  if (average <= DIFFICULTY_THRESHOLDS.beginner) return 'beginner'
  if (average <= DIFFICULTY_THRESHOLDS.easy) return 'easy'
  if (average <= DIFFICULTY_THRESHOLDS.intermediate) return 'intermediate'
  return 'experienced'
}

function photoUrl(pattern) {
  const photo = pattern.photos?.[0]
  return trimOrNull(photo?.medium2_url) ?? trimOrNull(photo?.medium_url) ?? trimOrNull(photo?.small2_url)
}

// Ravelry Pattern (full) → the PB `patterns` fields this import sets. PB has no NULLs here:
// unset selects/text → '' and unset numbers → 0, matching the app's own form builder.
function mapPatternFields(pattern, shelf, fetchedAt) {
  return {
    title: trimOrNull(pattern.name) ?? `Ravelry pattern ${pattern.id}`,
    designer: trimOrNull(pattern.pattern_author?.name) ?? '',
    source_url: `${RAVELRY_LIBRARY_BASE}${pattern.permalink}`,
    source_name: 'Ravelry',
    craft: mapCraft(pattern),
    yarn_weight: YARN_WEIGHT_TO_CYC[trimOrNull(pattern.yarn_weight?.name) ?? ''] ?? '',
    hook_mm: mapHookMm(pattern.pattern_needle_sizes) ?? 0,
    gauge: trimOrNull(pattern.gauge_description) ?? '',
    yardage: typeof pattern.yardage === 'number' ? pattern.yardage : 0,
    yardage_max: typeof pattern.yardage_max === 'number' ? pattern.yardage_max : 0,
    difficulty: mapDifficulty(pattern.difficulty_average, pattern.difficulty_count) ?? '',
    shelf,
    visibility: 'private',
    notes: trimOrNull(pattern.notes_html) ?? '',
    ravelry_id: pattern.id,
    ravelry_fetched_at: fetchedAt,
  }
}

// ---------------------------------------------------------------------------
// Smoke test — proves the key works, zero writes (RAVELRY.md §9 #5 replacement)
// ---------------------------------------------------------------------------

const currentUser = await ravelryGet('/current_user.json')
const username = currentUser?.user?.username
if (!username) {
  console.error('FAIL  current_user.json returned no username; response follows')
  console.error(JSON.stringify(currentUser).slice(0, 500))
  process.exit(1)
}
console.log(`OK    authenticated to Ravelry as “${username}”`)

if (mode === '--smoke') {
  const first = await ravelryGet(
    `/people/${encodeURIComponent(username)}/favorites/list.json?types=pattern&page=1&page_size=5`,
  )
  const total = first?.paginator?.results ?? 0
  console.log(`OK    favorites/list reachable — ${total} favorited pattern(s) total`)
  console.log('ravelry-import: smoke test passed; run `npm run ravelry:import` for the real thing')
  process.exit(0)
}

// ---------------------------------------------------------------------------
// PB auth (as the owner-to-be; createRule demands it)
// ---------------------------------------------------------------------------

const pb = new PocketBase(PB_URL)
try {
  await pb
    .collection('users')
    .authWithPassword(required.RAVELRY_IMPORT_OWNER_EMAIL, required.RAVELRY_IMPORT_OWNER_PASSWORD)
} catch (err) {
  console.error(
    `ravelry-import: PB auth failed at ${PB_URL} — is PocketBase running and are` +
      ' RAVELRY_IMPORT_OWNER_EMAIL / RAVELRY_IMPORT_OWNER_PASSWORD correct?',
  )
  console.error(err)
  process.exit(1)
}
const me = pb.authStore.record.id
console.log(`OK    writing to PocketBase as ${required.RAVELRY_IMPORT_OWNER_EMAIL}`)

// ---------------------------------------------------------------------------
// Collect: favorites → queue → library (order = shelf precedence)
// ---------------------------------------------------------------------------

const person = encodeURIComponent(username)

const favorites = await ravelryPages(
  (page) => `/people/${person}/favorites/list.json?types=pattern&page=${page}&page_size=${PAGE_SIZE}`,
  (data) => data.favorites ?? [],
)
console.log(`OK    favorites listed — ${favorites.length}`)

const queued = await ravelryPages(
  (page) => `/people/${person}/queue/list.json?page=${page}&page_size=${PAGE_SIZE}`,
  (data) => data.queued_projects ?? [],
)
console.log(`OK    queue listed — ${queued.length}`)

const volumes = await ravelryPages(
  (page) => `/people/${person}/library/search.json?page=${page}&page_size=${PAGE_SIZE}`,
  (data) => data.volumes ?? [],
)
console.log(`OK    library listed — ${volumes.length} volume(s)`)

// pattern id → { shelf, tags: Set } with first-list-wins shelf precedence; tags union.
const wanted = new Map()
function claim(patternId, shelf, tags = []) {
  const id = Number(patternId)
  if (!Number.isInteger(id) || id <= 0) return
  const entry = wanted.get(id) ?? { shelf, tags: new Set() }
  for (const tag of tags) entry.tags.add(tag)
  wanted.set(id, entry)
}

// First-seen order of tag names drives the color round-robin — deterministic across re-runs.
const tagOrder = []
for (const bookmark of favorites) {
  if (bookmark?.type !== 'pattern' || !bookmark?.favorited?.id) continue
  const tags = (bookmark.tag_list ?? '').split(/\s+/).filter(Boolean)
  for (const tag of tags) if (!tagOrder.includes(tag)) tagOrder.push(tag)
  claim(bookmark.favorited.id, 'want_to_make', tags)
}
for (const item of queued) claim(item?.pattern_id, 'queued') // pattern_id nullable: pattern-less queue rows are skipped by claim()
for (const volume of volumes) claim(volume?.pattern_id, 'saved') // nullable too: books/magazines have no single pattern

console.log(`OK    ${wanted.size} distinct pattern(s) to import`)

// ---------------------------------------------------------------------------
// Tags: lookup-or-create, colors round-robin in first-seen order
// ---------------------------------------------------------------------------

const tagIdsByName = new Map()
for (const [index, name] of tagOrder.entries()) {
  const label = `tag “${name}”`
  try {
    const existing = await pb
      .collection('tags')
      .getFirstListItem(pb.filter('owner = {:me} && name = {:name}', { me, name }))
    tagIdsByName.set(name, existing.id)
    console.log(`SKIP  ${label} (already exists)`)
  } catch (err) {
    if (err?.status !== 404) {
      console.error(`FAIL  ${label}: unexpected lookup error`)
      console.error(err)
      process.exit(1)
    }
    const created = await pb
      .collection('tags')
      .create({ owner: me, name, color: TAG_COLORS[index % TAG_COLORS.length] })
    tagIdsByName.set(name, created.id)
    console.log(`OK    ${label} (created)`)
  }
}

// ---------------------------------------------------------------------------
// Batch details + idempotent create/update + thumbnails
// ---------------------------------------------------------------------------

async function fetchThumbnailFile(pattern) {
  const url = photoUrl(pattern)
  if (!url) return null
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
    if (!res.ok) throw new Error(`CDN responded ${res.status}`)
    const blob = await res.blob()
    const name = new URL(url).pathname.split('/').filter(Boolean).pop() || 'ravelry-thumbnail'
    return new File([blob], name, { type: blob.type || 'image/jpeg' })
  } catch (err) {
    console.log(`SKIP  thumbnail for ravelry_id=${pattern.id} (${String(err)})`)
    return null
  }
}

const ids = [...wanted.keys()]
const fetchedAt = new Date().toISOString().replace('T', ' ')
let createdCount = 0
let updatedCount = 0
let skippedCount = 0

for (let start = 0; start < ids.length; start += BATCH_SIZE) {
  const chunk = ids.slice(start, start + BATCH_SIZE)
  const batch = await ravelryGet(`/patterns.json?ids=${chunk.join('+')}`)
  const byId = batch?.patterns ?? {}

  for (const id of chunk) {
    const pattern = byId[String(id)]
    const label = `pattern ravelry_id=${id}`
    if (!pattern || typeof pattern.id !== 'number' || !pattern.permalink) {
      skippedCount += 1
      console.log(`SKIP  ${label} (missing from batch response — deleted or hidden?)`)
      continue
    }

    const { shelf, tags } = wanted.get(id)
    const fields = {
      ...mapPatternFields(pattern, shelf, fetchedAt),
      tags: [...tags].map((name) => tagIdsByName.get(name)).filter(Boolean),
    }

    let existing = null
    try {
      existing = await pb
        .collection('patterns')
        .getFirstListItem(pb.filter('owner = {:me} && ravelry_id = {:id}', { me, id }))
    } catch (err) {
      if (err?.status !== 404) {
        console.error(`FAIL  ${label}: unexpected lookup error`)
        console.error(err)
        process.exit(1)
      }
    }

    try {
      if (existing) {
        // Re-run: refresh fields; leave a stored thumbnail alone (no redundant CDN hit).
        const thumbnail = existing.thumbnail ? null : await fetchThumbnailFile(pattern)
        await pb
          .collection('patterns')
          .update(existing.id, thumbnail ? { ...fields, thumbnail } : fields)
        updatedCount += 1
        console.log(`OK    ${label} “${fields.title}” (updated)`)
      } else {
        const thumbnail = await fetchThumbnailFile(pattern)
        await pb
          .collection('patterns')
          .create(thumbnail ? { ...fields, owner: me, thumbnail } : { ...fields, owner: me })
        createdCount += 1
        console.log(`OK    ${label} “${fields.title}” (created)`)
      }
    } catch (err) {
      console.error(`FAIL  ${label}: PB write failed`)
      console.error(err)
      process.exit(1)
    }
  }
}

console.log(
  `ravelry-import: done — ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped` +
    ` (of ${ids.length}; favorites ${favorites.length}, queue ${queued.length}, library ${volumes.length})`,
)
