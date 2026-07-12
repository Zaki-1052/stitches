// scripts/seed.mjs — seed the two demo users for local dev (Session 0.2).
// The `users` createRule is locked (the invite gate), so we authenticate as a superuser first and
// create the accounts through the admin API. Every credential comes from an env var — nothing is
// hardcoded. Idempotent: existing users are skipped. Fails loudly; no fallbacks.
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

console.log(`seed: done — ${created} created, ${demoUsers.length - created} skipped`)
