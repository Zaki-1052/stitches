// scripts/seed.mjs — seed local dev data. Session 0.2: the two demo users (the `users`
// createRule is locked — the invite gate — so accounts go through a superuser). Session 1.1:
// each user's starter library — tags covering all five accent colors and six patterns
// (each user gets at least one friends-visible and one private), created while authenticated
// AS that user so the seed itself exercises the create rules. Session 6.1: a small yarn stash
// each (weights spread, ≥1 shared + ≥1 private) plus one starter project linking a seeded
// pattern and a seeded yarn, so the stash, picker, and chips have something real to show.
// Every credential comes from an env var — nothing is hardcoded. Idempotent: existing records
// are skipped. Fails loudly.
import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

const required = {
  SUPERUSER_EMAIL: process.env.SUPERUSER_EMAIL,
  SUPERUSER_PASSWORD: process.env.SUPERUSER_PASSWORD,
  SEED_USER1_EMAIL: process.env.SEED_USER1_EMAIL,
  SEED_USER1_PASSWORD: process.env.SEED_USER1_PASSWORD,
  SEED_USER1_NAME: process.env.SEED_USER1_NAME,
  SEED_USER2_EMAIL: process.env.SEED_USER2_EMAIL,
  SEED_USER2_PASSWORD: process.env.SEED_USER2_PASSWORD,
  SEED_USER2_NAME: process.env.SEED_USER2_NAME,
}

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length) {
  console.error('seed: missing required env vars:')
  for (const key of missing) console.error(`  - ${key}`)
  process.exit(1)
}

const demoUsers = [
  {
    email: required.SEED_USER1_EMAIL,
    password: required.SEED_USER1_PASSWORD,
    name: required.SEED_USER1_NAME,
  },
  {
    email: required.SEED_USER2_EMAIL,
    password: required.SEED_USER2_PASSWORD,
    name: required.SEED_USER2_NAME,
  },
]

const pb = new PocketBase(PB_URL)

try {
  await pb
    .collection('_superusers')
    .authWithPassword(required.SUPERUSER_EMAIL, required.SUPERUSER_PASSWORD)
} catch (err) {
  console.error(
    `seed: superuser auth failed at ${PB_URL} — is PocketBase running (npm run dev) and are` +
      ' SUPERUSER_EMAIL / SUPERUSER_PASSWORD correct?',
  )
  console.error(err)
  process.exit(1)
}

let created = 0
for (const user of demoUsers) {
  try {
    await pb.collection('users').getFirstListItem(`email="${user.email}"`)
    console.log(`SKIP  ${user.email} (already exists)`)
  } catch (err) {
    if (err?.status !== 404) {
      console.error(`FAIL  ${user.email}: unexpected lookup error`)
      console.error(err)
      process.exit(1)
    }
    await pb.collection('users').create({
      email: user.email,
      password: user.password,
      passwordConfirm: user.password,
      name: user.name,
      verified: true,
    })
    created += 1
    console.log(`OK    ${user.email} (created)`)
  }
}

console.log(`seed: users done — ${created} created, ${demoUsers.length - created} skipped`)

// ---------------------------------------------------------------------------
// Session 1.1: starter library — tags covering all five accent colors and six
// patterns (each user: ≥1 friends-visible + ≥1 private). Created as each user.
// ---------------------------------------------------------------------------

const libraries = [
  {
    email: required.SEED_USER1_EMAIL,
    password: required.SEED_USER1_PASSWORD,
    tags: [
      { name: 'amigurumi', color: 'coral' },
      { name: 'wearables', color: 'blue' },
      { name: 'gifts', color: 'butter' },
    ],
    patterns: [
      {
        title: 'Bee Amigurumi',
        visibility: 'friends',
        craft: 'crochet',
        yarn_weight: 'cyc_2',
        hook_mm: 3.5,
        difficulty: 'easy',
        shelf: 'saved',
        designer: 'Junie Makes',
        source_name: 'Ravelry',
        gauge: '6 sc = 1 in on 3.5 mm',
        yardage: 40,
        tags: ['amigurumi', 'gifts'],
        notes: '<p>Chenille yarn makes the fuzziest bee. Safety eyes before stuffing!</p>',
      },
      {
        title: 'Granny Square Cardigan',
        visibility: 'private',
        craft: 'crochet',
        yarn_weight: 'cyc_4',
        hook_mm: 5,
        difficulty: 'intermediate',
        shelf: 'want_to_make',
        source_name: "Grandma's binder",
        gauge: 'one square = 4 in on 5.0 mm',
        yardage: 1200,
        yardage_max: 1500,
        tags: ['wearables'],
        notes: '<p>Size up for the oversized look. Join-as-you-go saves so much sewing.</p>',
      },
      {
        title: 'Mushroom Keychain',
        visibility: 'friends',
        craft: 'crochet',
        yarn_weight: 'cyc_2',
        hook_mm: 3,
        difficulty: 'beginner',
        shelf: 'queued',
        gauge: 'tight — stuffing must not show',
        yardage: 25,
        tags: ['amigurumi', 'gifts'],
      },
    ],
    yarns: [
      {
        name: 'Softee Chunky',
        brand: 'Bernat',
        colorway: 'Glowing Gold',
        weight: 'cyc_6',
        fiber: '100% acrylic',
        yardage_per_skein: 108,
        skein_count: 3,
        visibility: 'friends',
        notes: '<p>The bee yarn. Fuzzy, forgiving, gone too fast.</p>',
      },
      {
        name: 'Velvet',
        brand: 'Bernat',
        colorway: 'Misty Gray',
        weight: 'cyc_5',
        fiber: '100% polyester',
        yardage_per_skein: 315,
        skein_count: 2,
        visibility: 'private',
      },
      {
        name: 'Simply Soft',
        brand: 'Caron',
        colorway: 'Pistachio',
        weight: 'cyc_4',
        fiber: '100% acrylic',
        yardage_per_skein: 315,
        skein_count: 5,
        visibility: 'friends',
      },
    ],
    project: {
      name: 'Bee for Cece',
      pattern: 'Bee Amigurumi',
      linkYarn: 'Softee Chunky',
      status: 'planned',
    },
  },
  {
    email: required.SEED_USER2_EMAIL,
    password: required.SEED_USER2_PASSWORD,
    tags: [
      { name: 'blankets', color: 'mint' },
      { name: 'quick wins', color: 'lilac' },
    ],
    patterns: [
      {
        title: 'Ripple Blanket',
        visibility: 'friends',
        craft: 'crochet',
        yarn_weight: 'cyc_4',
        hook_mm: 5.5,
        difficulty: 'easy',
        shelf: 'saved',
        source_name: 'Ravelry',
        gauge: '14 dc × 8 rows = 4 in',
        yardage: 900,
        yardage_max: 1100,
        tags: ['blankets'],
        notes: '<p>Count the valleys, not the peaks.</p>',
      },
      {
        title: 'Cotton Dishcloth',
        visibility: 'private',
        craft: 'crochet',
        yarn_weight: 'cyc_3',
        hook_mm: 4,
        difficulty: 'beginner',
        shelf: 'saved',
        yardage: 60,
        tags: ['quick wins'],
      },
      {
        title: 'Star Coaster',
        visibility: 'private',
        craft: 'crochet',
        yarn_weight: 'cyc_2',
        hook_mm: 3.5,
        difficulty: 'easy',
        shelf: 'queued',
        yardage: 30,
        tags: ['quick wins'],
      },
    ],
    yarns: [
      {
        name: 'Super Saver',
        brand: 'Red Heart',
        colorway: 'Aran',
        weight: 'cyc_4',
        fiber: '100% acrylic',
        yardage_per_skein: 364,
        skein_count: 6,
        visibility: 'friends',
      },
      {
        name: "Sugar'n Cream",
        brand: 'Lily',
        colorway: 'Hot Blue',
        weight: 'cyc_3',
        fiber: '100% cotton',
        yardage_per_skein: 120,
        skein_count: 4,
        visibility: 'private',
        notes: '<p>Dishcloth cotton. Rough on the hands, worth it.</p>',
      },
    ],
    project: {
      name: 'Ripple for the couch',
      pattern: 'Ripple Blanket',
      linkYarn: 'Super Saver',
      status: 'planned',
    },
  },
]

// Look up by the same key the schema's unique/ownership semantics use; 404 means "create it".
async function ensureRecord(client, collection, filter, data, label) {
  try {
    await client.collection(collection).getFirstListItem(filter)
    console.log(`SKIP  ${label} (already exists)`)
    return false
  } catch (err) {
    if (err?.status !== 404) {
      console.error(`FAIL  ${label}: unexpected lookup error`)
      console.error(err)
      process.exit(1)
    }
    await client.collection(collection).create(data)
    console.log(`OK    ${label} (created)`)
    return true
  }
}

for (const library of libraries) {
  const client = new PocketBase(PB_URL)
  try {
    await client.collection('users').authWithPassword(library.email, library.password)
  } catch (err) {
    console.error(`seed: auth as ${library.email} failed — were the demo users just created above?`)
    console.error(err)
    process.exit(1)
  }
  const me = client.authStore.record.id

  for (const tag of library.tags) {
    await ensureRecord(
      client,
      'tags',
      client.filter('owner = {:me} && name = {:name}', { me, name: tag.name }),
      { owner: me, name: tag.name, color: tag.color },
      `tag “${tag.name}” (${library.email})`,
    )
  }

  // Tag ids by name, for the patterns' relation field.
  const myTags = await client.collection('tags').getFullList({
    filter: client.filter('owner = {:me}', { me }),
  })
  const tagIdsByName = Object.fromEntries(myTags.map((tag) => [tag.name, tag.id]))

  for (const pattern of library.patterns) {
    const tagIds = (pattern.tags ?? []).map((name) => {
      const id = tagIdsByName[name]
      if (!id) {
        console.error(`seed: pattern “${pattern.title}” references unknown tag “${name}”`)
        process.exit(1)
      }
      return id
    })
    await ensureRecord(
      client,
      'patterns',
      client.filter('owner = {:me} && title = {:title}', { me, title: pattern.title }),
      { ...pattern, owner: me, tags: tagIds },
      `pattern “${pattern.title}” (${library.email})`,
    )
  }

  for (const yarn of library.yarns) {
    await ensureRecord(
      client,
      'yarns',
      // No unique index on yarns (re-buying a colorway is legitimate) — owner+name+colorway is
      // purely the seed's idempotency key.
      client.filter('owner = {:me} && name = {:name} && colorway = {:colorway}', {
        me,
        name: yarn.name,
        colorway: yarn.colorway,
      }),
      { ...yarn, owner: me },
      `yarn “${yarn.name}” (${library.email})`,
    )
  }

  // One starter project per user, linked to a seeded pattern AND a seeded yarn at create time —
  // the create itself exercises both link guards. getFirstListItem throws on a miss: a seed
  // referencing unknown records is a bug, not a case to tolerate.
  const linkedPattern = await client
    .collection('patterns')
    .getFirstListItem(
      client.filter('owner = {:me} && title = {:title}', { me, title: library.project.pattern }),
    )
  const linkedYarn = await client
    .collection('yarns')
    .getFirstListItem(
      client.filter('owner = {:me} && name = {:name}', { me, name: library.project.linkYarn }),
    )
  await ensureRecord(
    client,
    'projects',
    client.filter('owner = {:me} && name = {:name}', { me, name: library.project.name }),
    {
      owner: me,
      name: library.project.name,
      status: library.project.status,
      pattern: linkedPattern.id,
      yarns: [linkedYarn.id],
    },
    `project “${library.project.name}” (${library.email})`,
  )
}

console.log('seed: library done')
