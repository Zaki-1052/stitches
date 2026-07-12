// scripts/rules-check.mjs — permanent access-matrix regression test (PLAN Session 1.1).
// Proves the SPEC §7 rules against a RUNNING PocketBase: anonymous / owner / other-user across
// every collection, plus the cascade and blocked-delete behavior the schema promises. It is
// self-contained on purpose — two demo-user credentials, NO superuser — because PLAN re-runs it
// in Sessions 1.3 and 4.1 and against prod in 5.1: it creates its own `[rules-check]`-prefixed
// fixtures and removes every one of them on the way out.
//
// Env: PB_URL (default http://127.0.0.1:8090),
//      SEED_USER1_EMAIL / SEED_USER1_PASSWORD, SEED_USER2_EMAIL / SEED_USER2_PASSWORD.
// Run: npm run verify:rules   (PocketBase must be running)
import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const MARK = '[rules-check]'

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
  console.error('rules-check: missing required env vars:')
  for (const key of missing) console.error(`  - ${key}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// personas + assertion helpers
// ---------------------------------------------------------------------------

const anon = new PocketBase(PB_URL)
const a = new PocketBase(PB_URL) // "owner" persona (user 1)
const b = new PocketBase(PB_URL) // "other user" persona (user 2)

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

function describeError(err) {
  return `status=${err?.status} body=${JSON.stringify(err?.response ?? String(err))}`
}

// The operation must succeed.
async function expectOk(label, fn) {
  try {
    const out = await fn()
    pass(label)
    return out
  } catch (err) {
    fail(label, `expected success, got ${describeError(err)}`)
    return null
  }
}

// The operation must be rejected. PB denials surface as 400 (create/validation),
// 403 (explicit forbid), or 404 (record invisible under the rule filter).
async function expectDenied(label, fn) {
  try {
    await fn()
    fail(label, 'expected denial, but the call succeeded')
  } catch (err) {
    if ([400, 401, 403, 404].includes(err?.status)) pass(label)
    else fail(label, `expected 400/401/403/404, got ${describeError(err)}`)
  }
}

// List rules act as filters (200 + filtered items), so list checks assert membership.
async function expectListed(label, client, collection, id) {
  try {
    const items = await client.collection(collection).getFullList()
    if (items.some((r) => r.id === id)) pass(label)
    else fail(label, `record ${id} missing from ${collection} list (${items.length} items)`)
  } catch (err) {
    fail(label, `list failed: ${describeError(err)}`)
  }
}

async function expectNotListed(label, client, collection, id) {
  try {
    const items = await client.collection(collection).getFullList()
    if (items.some((r) => r.id === id)) fail(label, `record ${id} leaked into ${collection} list`)
    else pass(label)
  } catch (err) {
    fail(label, `list failed: ${describeError(err)}`)
  }
}

// "Sees nothing at all": an empty filtered result or an outright auth error both satisfy it.
async function expectListEmpty(label, client, collection) {
  try {
    const result = await client.collection(collection).getList(1, 1)
    if (result.totalItems === 0) pass(label)
    else fail(label, `expected 0 items, got totalItems=${result.totalItems}`)
  } catch (err) {
    if ([400, 401, 403].includes(err?.status)) pass(label)
    else fail(label, `expected empty list or auth error, got ${describeError(err)}`)
  }
}

// Raw fetches against Protected file URLs (Session 1.3): PB re-checks the view rule on every
// file request, so a denial surfaces as a non-200 response (404), not an SDK error.
async function expectFileOk(label, url) {
  try {
    const res = await fetch(url)
    await res.arrayBuffer() // drain the body either way
    if (res.ok) pass(label)
    else fail(label, `expected 200, got ${res.status}`)
  } catch (err) {
    fail(label, `fetch threw: ${err}`)
  }
}

async function expectFileDenied(label, url) {
  try {
    const res = await fetch(url)
    await res.arrayBuffer()
    if (res.ok) fail(label, `expected a denial status, got ${res.status}`)
    else pass(label)
  } catch (err) {
    fail(label, `fetch threw: ${err}`)
  }
}

// ---------------------------------------------------------------------------
// sweep — remove leftover fixtures from a crashed previous run (idempotency).
// Children before parents, and projects unlink their pattern first, so leftovers
// can never strand a pattern behind the blocked-while-linked delete guard.
// ---------------------------------------------------------------------------

async function sweep(client) {
  // Owner-scoped: shared fixtures of the OTHER user are visible here too, and deleting or
  // unlinking records you don't own would 404 and crash the sweep.
  const mine = (field) => ({
    filter: client.filter(`${field} ~ {:mark} && owner = {:me}`, {
      mark: MARK,
      me: client.authStore.record.id,
    }),
  })

  for (const project of await client.collection('projects').getFullList(mine('name'))) {
    if (project.pattern) await client.collection('projects').update(project.id, { pattern: '' })
    await client.collection('projects').delete(project.id) // entries + counters cascade
  }
  for (const pattern of await client.collection('patterns').getFullList(mine('title'))) {
    await client.collection('patterns').delete(pattern.id) // attachments cascade
  }
  for (const tag of await client.collection('tags').getFullList(mine('name'))) {
    await client.collection('tags').delete(tag.id)
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

try {
  await a.collection('users').authWithPassword(required.SEED_USER1_EMAIL, required.SEED_USER1_PASSWORD)
  await b.collection('users').authWithPassword(required.SEED_USER2_EMAIL, required.SEED_USER2_PASSWORD)
} catch (err) {
  console.error(`rules-check: user auth failed at ${PB_URL} — is PocketBase running and are the`)
  console.error('SEED_USER1_/SEED_USER2_ credentials correct?')
  console.error(describeError(err))
  process.exit(1)
}

const aId = a.authStore.record.id
const bId = b.authStore.record.id
const today = new Date().toISOString().slice(0, 10)

console.log(`rules-check: ${PB_URL} · A=${required.SEED_USER1_EMAIL} · B=${required.SEED_USER2_EMAIL}`)

console.log('\n--- phase 0: sweep leftovers ---')
await sweep(a)
await sweep(b)
console.log('sweep done')

console.log('\n--- phase 1: fixtures ---')
const tagA = await a.collection('tags').create({ owner: aId, name: `${MARK} test-tag`, color: 'coral' })
const patternPrivA = await a.collection('patterns').create({
  owner: aId,
  title: `${MARK} private pattern (A)`,
  visibility: 'private',
  craft: 'crochet',
})
const patternSharedA = await a.collection('patterns').create({
  owner: aId,
  title: `${MARK} shared pattern (A)`,
  visibility: 'friends',
  craft: 'crochet',
  tags: [tagA.id],
})
const attachmentA = await a.collection('pattern_attachments').create({
  owner: aId,
  pattern: patternSharedA.id,
  label: `${MARK} vault attachment (A)`,
  pattern_text: '<p>owner-only instructions</p>',
})
const projectPrivA = await a.collection('projects').create({
  owner: aId,
  name: `${MARK} private project (A)`,
  visibility: 'private',
  status: 'in_progress',
})
const projectSharedA = await a.collection('projects').create({
  owner: aId,
  name: `${MARK} shared project (A)`,
  visibility: 'friends',
  status: 'in_progress',
})
const entryOnPrivA = await a.collection('journal_entries').create({
  owner: aId,
  project: projectPrivA.id,
  entry_date: today,
  body: '<p>private diary</p>',
})
const entryOnSharedA = await a.collection('journal_entries').create({
  owner: aId,
  project: projectSharedA.id,
  entry_date: today,
  body: '<p>shared diary</p>',
})
const counterA = await a.collection('counters').create({
  owner: aId,
  project: projectSharedA.id,
  label: `${MARK} rows (A)`,
  value: 0,
})
const tagB = await b.collection('tags').create({ owner: bId, name: `${MARK} test-tag`, color: 'mint' })
const patternB = await b.collection('patterns').create({
  owner: bId,
  title: `${MARK} private pattern (B)`,
  visibility: 'private',
})
const projectB = await b.collection('projects').create({
  owner: bId,
  name: `${MARK} project (B)`,
  visibility: 'private',
})
console.log('fixtures created (9 for A, 3 for B — cross-owner same-name tag included)')

console.log('\n--- phase 2: access matrix ---')

console.log('· anonymous sees nothing, can touch nothing')
for (const collection of ['users', 'tags', 'patterns', 'pattern_attachments', 'projects', 'journal_entries', 'counters']) {
  await expectListEmpty(`anon list ${collection} → empty`, anon, collection)
}
await expectDenied('anon view shared pattern → 404', () => anon.collection('patterns').getOne(patternSharedA.id))
await expectDenied('anon view shared project → 404', () => anon.collection('projects').getOne(projectSharedA.id))
await expectDenied('anon view shared-project entry → 404', () => anon.collection('journal_entries').getOne(entryOnSharedA.id))
await expectDenied('anon create user (invite gate)', () =>
  anon.collection('users').create({
    email: 'intruder@stitches.local',
    password: 'not-getting-in-1',
    passwordConfirm: 'not-getting-in-1',
    name: 'Intruder',
  }),
)
await expectDenied('anon create pattern', () => anon.collection('patterns').create({ owner: aId, title: `${MARK} anon` }))
await expectDenied('anon update shared pattern', () => anon.collection('patterns').update(patternSharedA.id, { title: `${MARK} defaced` }))
await expectDenied('anon delete shared pattern', () => anon.collection('patterns').delete(patternSharedA.id))

console.log('· users')
await expectListed('B lists users → sees A (authed read)', b, 'users', aId)
await expectDenied('B update A profile', () => b.collection('users').update(aId, { name: 'Hijacked' }))
await expectOk('A update own profile', () => a.collection('users').update(aId, { name: a.authStore.record.name }))

console.log('· tags')
await expectListed('B lists tags → sees A tag (shared patterns must render tags)', b, 'tags', tagA.id)
await expectDenied('B update A tag', () => b.collection('tags').update(tagA.id, { color: 'butter' }))
await expectDenied('B delete A tag', () => b.collection('tags').delete(tagA.id))
await expectOk('A update own tag', () => a.collection('tags').update(tagA.id, { color: 'lilac' }))
await expectDenied('A duplicate (owner,name) tag → unique index', () =>
  a.collection('tags').create({ owner: aId, name: `${MARK} test-tag`, color: 'blue' }),
)
pass('A and B own same-named tags side by side (fixtures)') // composite (owner,name), not name-only

console.log('· patterns')
await expectListed('A lists own private pattern', a, 'patterns', patternPrivA.id)
await expectListed('A lists own shared pattern', a, 'patterns', patternSharedA.id)
await expectListed('B lists A shared pattern', b, 'patterns', patternSharedA.id)
await expectNotListed('B does not list A private pattern', b, 'patterns', patternPrivA.id)
await expectOk('B views A shared pattern', () => b.collection('patterns').getOne(patternSharedA.id))
await expectDenied('B view A private pattern → 404', () => b.collection('patterns').getOne(patternPrivA.id))
await expectOk('A updates own pattern (ordinary field)', () => a.collection('patterns').update(patternPrivA.id, { gauge: '14 sc × 16 rows = 4 in' }))
await expectDenied('A owner-transfer own pattern → B', () => a.collection('patterns').update(patternPrivA.id, { owner: bId }))
await expectDenied('B create pattern owned by A', () => b.collection('patterns').create({ owner: aId, title: `${MARK} forged (B)` }))
await expectDenied('B update A shared pattern', () => b.collection('patterns').update(patternSharedA.id, { title: `${MARK} defaced` }))
await expectDenied('B delete A shared pattern', () => b.collection('patterns').delete(patternSharedA.id))

console.log('· pattern_attachments — the copyright vault')
await expectListed('A lists own attachment', a, 'pattern_attachments', attachmentA.id)
await expectOk('A views own attachment', () => a.collection('pattern_attachments').getOne(attachmentA.id))
await expectNotListed('B does NOT list attachment on A SHARED pattern (headline)', b, 'pattern_attachments', attachmentA.id)
await expectDenied('B view attachment on A SHARED pattern → 404 (headline)', () => b.collection('pattern_attachments').getOne(attachmentA.id))
await expectDenied('B create attachment on A shared pattern', () =>
  b.collection('pattern_attachments').create({ owner: bId, pattern: patternSharedA.id, label: `${MARK} sneak (B)` }),
)
await expectDenied('B update A attachment', () => b.collection('pattern_attachments').update(attachmentA.id, { label: `${MARK} defaced` }))
await expectDenied('B delete A attachment', () => b.collection('pattern_attachments').delete(attachmentA.id))
await expectOk('A updates attachment resending unchanged pattern (:changed lock stays open)', () =>
  a.collection('pattern_attachments').update(attachmentA.id, { label: `${MARK} vault attachment v2 (A)`, pattern: patternSharedA.id }),
)
await expectDenied('A re-parents attachment to another own pattern (:changed lock)', () =>
  a.collection('pattern_attachments').update(attachmentA.id, { pattern: patternPrivA.id }),
)

console.log('· pattern_attachments — protected file access (the token gate, Session 1.3)')
// Minimal-but-sniffable PDF: enough structure for content-type detection. It is only ever
// stored and fetched raw — nothing parses it. Cleanup rides the existing phase-3 cascade
// (this attachment dies with patternSharedA), so the ×2 idempotent run stays intact.
const scanBytes = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 3 3]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
)
const scanFd = new FormData()
scanFd.append('owner', aId)
scanFd.append('pattern', patternSharedA.id)
scanFd.append('label', `${MARK} vintage scan (A)`)
scanFd.append('files', new Blob([scanBytes], { type: 'application/pdf' }), 'vintage-scan.pdf')
const attachmentFileA = await expectOk('A creates attachment with a real file', () =>
  a.collection('pattern_attachments').create(scanFd),
)
if (attachmentFileA) {
  const scanFilename = attachmentFileA.files[0]
  await expectFileDenied(
    'fetch protected file with NO token → denied',
    a.files.getURL(attachmentFileA, scanFilename),
  )
  const tokenB = await expectOk('B gets a file token of their own', () => b.files.getToken())
  if (tokenB) {
    await expectFileDenied(
      "fetch protected file with B's token → denied (view rule re-checked per fetch)",
      a.files.getURL(attachmentFileA, scanFilename, { token: tokenB }),
    )
  }
  const tokenA = await expectOk('A gets a file token', () => a.files.getToken())
  if (tokenA) {
    await expectFileOk(
      "fetch protected file with A's token → 200 (owner playback)",
      a.files.getURL(attachmentFileA, scanFilename, { token: tokenA }),
    )
  }
}

console.log('· projects')
await expectListed('B lists A shared project', b, 'projects', projectSharedA.id)
await expectNotListed('B does not list A private project', b, 'projects', projectPrivA.id)
await expectOk('B views A shared project', () => b.collection('projects').getOne(projectSharedA.id))
await expectDenied('B view A private project → 404', () => b.collection('projects').getOne(projectPrivA.id))
await expectDenied('B create project owned by A', () => b.collection('projects').create({ owner: aId, name: `${MARK} forged (B)` }))
await expectDenied('B update A shared project', () => b.collection('projects').update(projectSharedA.id, { name: `${MARK} defaced` }))
await expectDenied('B delete A shared project', () => b.collection('projects').delete(projectSharedA.id))
await expectDenied('A owner-transfer own project → B', () => a.collection('projects').update(projectPrivA.id, { owner: bId }))

console.log('· projects ↔ patterns link guard')
await expectDenied('B create project linking A PRIVATE pattern', () =>
  b.collection('projects').create({ owner: bId, name: `${MARK} sneak-link (B)`, pattern: patternPrivA.id }),
)
const projectB2 = await expectOk('B create project linking A SHARED pattern (make-a-friend’s-pattern flow)', () =>
  b.collection('projects').create({ owner: bId, name: `${MARK} linked project (B)`, pattern: patternSharedA.id }),
)
await expectDenied('B re-point own project to A PRIVATE pattern', () => b.collection('projects').update(projectB.id, { pattern: patternPrivA.id }))
await expectOk('B re-point own project to A SHARED pattern', () => b.collection('projects').update(projectB.id, { pattern: patternSharedA.id }))
await expectOk('B unlink own project', () => b.collection('projects').update(projectB.id, { pattern: '' }))
await expectOk('A link-later: attach own pattern to own project', () => a.collection('projects').update(projectPrivA.id, { pattern: patternPrivA.id }))
await expectOk('A unlink own project again', () => a.collection('projects').update(projectPrivA.id, { pattern: '' }))

console.log('· journal_entries — visibility inherited from the project')
await expectListed('B lists entry on A SHARED project', b, 'journal_entries', entryOnSharedA.id)
await expectNotListed('B does not list entry on A PRIVATE project', b, 'journal_entries', entryOnPrivA.id)
await expectOk('B views entry on A shared project', () => b.collection('journal_entries').getOne(entryOnSharedA.id))
await expectDenied('B view entry on A private project → 404', () => b.collection('journal_entries').getOne(entryOnPrivA.id))
await expectDenied('B create entry on A shared project', () =>
  b.collection('journal_entries').create({ owner: bId, project: projectSharedA.id, entry_date: today, body: '<p>injected</p>' }),
)
await expectDenied('B update A entry', () => b.collection('journal_entries').update(entryOnSharedA.id, { body: '<p>defaced</p>' }))
await expectDenied('B delete A entry', () => b.collection('journal_entries').delete(entryOnSharedA.id))
await expectOk('A updates entry resending unchanged project (:changed lock stays open)', () =>
  a.collection('journal_entries').update(entryOnSharedA.id, { body: '<p>shared diary v2</p>', project: projectSharedA.id }),
)
await expectDenied('A re-parents entry to another own project (:changed lock)', () =>
  a.collection('journal_entries').update(entryOnSharedA.id, { project: projectPrivA.id }),
)

console.log('· counters — personal process, never shared')
await expectListed('A lists own counter', a, 'counters', counterA.id)
await expectNotListed('B does NOT list counter on A SHARED project (headline twin)', b, 'counters', counterA.id)
await expectDenied('B view counter on A SHARED project → 404 (headline twin)', () => b.collection('counters').getOne(counterA.id))
await expectDenied('B create counter on A shared project', () =>
  b.collection('counters').create({ owner: bId, project: projectSharedA.id, label: `${MARK} sneak (B)` }),
)
await expectDenied('B update A counter', () => b.collection('counters').update(counterA.id, { value: 999 }))
await expectDenied('B delete A counter', () => b.collection('counters').delete(counterA.id))
await expectOk('A updates counter resending unchanged project (:changed lock stays open)', () =>
  a.collection('counters').update(counterA.id, { value: 1, project: projectSharedA.id }),
)
await expectDenied('A re-parents counter to another own project (:changed lock)', () =>
  a.collection('counters').update(counterA.id, { project: projectPrivA.id }),
)
const counterA2 = await expectOk('A creates linked counter (resets_with self-relation)', () =>
  a.collection('counters').create({ owner: aId, project: projectSharedA.id, label: `${MARK} stitches (A)`, value: 0, resets_with: counterA.id }),
)

console.log('\n--- phase 3: behavior & cascade proofs (doubles as cleanup) ---')
await expectDenied('A delete shared pattern WHILE B project links it (blocked-while-linked)', () =>
  a.collection('patterns').delete(patternSharedA.id),
)
await expectOk('…and the pattern still exists afterwards', () => a.collection('patterns').getOne(patternSharedA.id))
await expectOk('B deletes own linking project', () => b.collection('projects').delete(projectB2.id))
await expectOk('A delete shared pattern once unlinked', () => a.collection('patterns').delete(patternSharedA.id))
await expectDenied('…attachment cascaded away with its pattern → 404', () => a.collection('pattern_attachments').getOne(attachmentA.id))
await expectOk('A deletes shared project', () => a.collection('projects').delete(projectSharedA.id))
await expectDenied('…journal entry cascaded away with its project → 404', () => a.collection('journal_entries').getOne(entryOnSharedA.id))
await expectDenied('…counter cascaded away with its project → 404', () => a.collection('counters').getOne(counterA.id))
if (counterA2) {
  await expectDenied('…linked counter cascaded away too → 404', () => a.collection('counters').getOne(counterA2.id))
}
await expectOk('A delete unlinked private pattern (guard permits zero back-links)', () => a.collection('patterns').delete(patternPrivA.id))
await expectOk('A deletes private project (entry cascades)', () => a.collection('projects').delete(projectPrivA.id))
await expectOk('A deletes own tag', () => a.collection('tags').delete(tagA.id))
await expectOk('B deletes own pattern', () => b.collection('patterns').delete(patternB.id))
await expectOk('B deletes own project', () => b.collection('projects').delete(projectB.id))
await expectOk('B deletes own tag', () => b.collection('tags').delete(tagB.id))

console.log('\n--- final sweep: zero fixtures left behind ---')
await sweep(a)
await sweep(b)
for (const client of [a, b]) {
  const who = client === a ? 'A' : 'B'
  for (const [collection, field] of [
    ['tags', 'name'],
    ['patterns', 'title'],
    ['projects', 'name'],
    ['counters', 'label'],
  ]) {
    const leftovers = await client.collection(collection).getFullList({
      filter: client.filter(`${field} ~ {:mark} && owner = {:me}`, {
        mark: MARK,
        me: client.authStore.record.id,
      }),
    })
    if (leftovers.length === 0) pass(`${who} sees no leftover ${collection} fixtures`)
    else fail(`${who} sees no leftover ${collection} fixtures`, `${leftovers.length} left: ${leftovers.map((r) => r.id).join(', ')}`)
  }
}

console.log(`\nrules-check: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
