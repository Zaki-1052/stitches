// scripts/verify/pb-autocancel.mjs — repro + fix proof for the Home hero "couldn't load" flash.
// The PocketBase SDK auto-cancels concurrent requests sharing a cancel key, and its DEFAULT key
// is method+path only (no query params) — so two list reads on the same collection with
// different filters cancel each other. Home mounts three `projects` reads at once (in-progress
// hero, made-✓ ids, any-projects probe), so after a create invalidates them all, the loser
// surfaces as the hero error. Zero network: fetch is stubbed with a delayed response so the
// requests genuinely overlap. Exits non-zero if the collision fails to reproduce OR if distinct
// requestKey values (the fix applied in web/src/features/projects/queries.ts) fail to prevent it.
import PocketBase from 'pocketbase'

const okBody = JSON.stringify({ page: 1, perPage: 500, totalItems: 0, totalPages: 1, items: [] })

globalThis.fetch = (_url, opts) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        resolve(
          new Response(okBody, { status: 200, headers: { 'Content-Type': 'application/json' } }),
        ),
      50,
    )
    opts?.signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    })
  })

const pb = new PocketBase('http://stub.invalid')

// Fire the same trio of overlapping reads Home issues, with per-call extra options.
async function homeTrio(label, [a, b, c]) {
  const results = await Promise.allSettled([
    pb.collection('projects').getFullList({ filter: 'status = "in_progress"', ...a }),
    pb.collection('projects').getFullList({ filter: 'status = "finished"', ...b }),
    pb.collection('projects').getFullList({ filter: 'owner = "me"', ...c }),
  ])
  const summary = results.map((r) =>
    r.status === 'fulfilled' ? 'ok' : r.reason?.isAbort ? 'AUTO-CANCELLED' : `error: ${r.reason}`,
  )
  console.log(`${label}: [${summary.join(', ')}]`)
  return results.every((r) => r.status === 'fulfilled')
}

const defaultKeysSurvive = await homeTrio('default cancel key (method+path)', [{}, {}, {}])
const distinctKeysSurvive = await homeTrio('distinct requestKey per query  ', [
  { requestKey: 'projects:list:me:in_progress' },
  { requestKey: 'projects:finishedPatternIds:me' },
  { requestKey: 'projects:list:me:all' },
])

if (defaultKeysSurvive) {
  console.error('UNEXPECTED: default cancel keys did not collide — root cause not reproduced')
  process.exit(1)
}
if (!distinctKeysSurvive) {
  console.error('FIX INEFFECTIVE: distinct requestKey values still cancelled each other')
  process.exit(1)
}
console.log('reproduced: default key cancels concurrent same-collection reads; distinct keys fix it')
