// web/src/lib/outbox.ts — the counter write queue (SPEC §11). Every counter *value* action is
// an op — inc(counterId, ±n) or set(counterId, value) — persisted synchronously to
// localStorage (kill-proof), folded over the server-truth query cache for display
// (features/counters/queries.ts holds server truth; foldValue overlays pending taps), and
// drained in order by a single-flight flusher: incs as PocketBase's atomic `{"value+": n}` so
// two devices never clobber each other, sets as last-write-wins. Flush triggers: append,
// `online`, `focus`, `visibilitychange`→visible, a 10 s tick while non-empty, and boot.
// initOutbox() is called from main.tsx — module-level wiring runs once per page load, so the
// queue flushes on reopen even if no counter screen ever mounts (and StrictMode's doubled
// effects never touch it).
//
// Cross-tab safety: tabs share the persisted queue, so the flusher runs under a Web Lock
// (double-flushing `value+` would double-count) and re-reads storage before every send;
// a `storage` listener keeps in-memory state — and thus every tab's folded display — fresh.
//
// Layering note: a lib/ module importing from features/ is inverted but acyclic — SPEC §6
// pins the outbox at lib/outbox.ts, and the cache writer lives with the counter queries.
import { useSyncExternalStore } from 'react'
import { ClientResponseError } from 'pocketbase'
import { pb } from './pb.ts'
import type { CounterRecord } from './schema.ts'
import { applyServerCounter } from '../features/counters/queries.ts'

export type CounterOp =
  | { kind: 'inc'; counterId: string; n: number }
  | { kind: 'set'; counterId: string; value: number }

export type QueuedOp = CounterOp & { id: string }

const STORAGE_KEY = 'stitches:outbox:v1'
const LOCK_NAME = 'stitches:outbox'
const TICK_MS = 10_000

let ops: readonly QueuedOp[] = []
// `undefined` = unknown, forces the next syncFromStorage to re-parse (raw is string | null).
let lastRaw: string | null | undefined = undefined
let currentOwner: string | null = null
let inFlightId: string | null = null
let flushInProgress = false
let tickTimer: number | null = null
let initialized = false

const queueListeners = new Set<() => void>()
const errorListeners = new Set<(message: string) => void>()

// ---- persistence ----

// Pure parse; null means "not this account's queue" (or unreadable) — caller discards it.
function parseQueue(raw: string | null): readonly QueuedOp[] | null {
  if (raw === null) return []
  try {
    const parsed = JSON.parse(raw) as { ownerId?: string; ops?: QueuedOp[] }
    if (parsed.ownerId === pb.authStore.record?.id && Array.isArray(parsed.ops)) {
      return parsed.ops
    }
    return null
  } catch {
    return null
  }
}

function syncFromStorage(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === lastRaw) return
  const parsed = parseQueue(raw)
  if (parsed === null) {
    console.warn('[outbox] discarding stored queue (different account or unreadable)')
    localStorage.removeItem(STORAGE_KEY)
    lastRaw = null
    ops = []
  } else {
    lastRaw = raw
    ops = parsed
  }
  emitQueueChange()
}

function save(): void {
  if (ops.length === 0) {
    localStorage.removeItem(STORAGE_KEY)
    lastRaw = null
    return
  }
  const raw = JSON.stringify({ ownerId: pb.authStore.record?.id ?? '', ops })
  localStorage.setItem(STORAGE_KEY, raw)
  lastRaw = raw
}

function commit(next: readonly QueuedOp[]): void {
  ops = next
  save()
  emitQueueChange()
}

function emitQueueChange(): void {
  for (const cb of queueListeners) cb()
  updateTick()
}

// ---- the queue ----

function lastIndexFor(list: readonly QueuedOp[], counterId: string): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].counterId === counterId) return i
  }
  return -1
}

// Append with per-counter compaction (ops on different counters commute, so this preserves
// each counter's op order — and the server's final state). A new inc merges into the last
// queued op for its counter when that op is a mergeable inc; a new set clobbers everything
// queued before it for its counter. Net effect: ≤2 queued ops per counter no matter how long
// the dead zone — ten airplane-mode taps flush as one {"value+": 10}. The op currently being
// sent is never merged into, edited, or removed.
export function appendOps(specs: readonly CounterOp[]): void {
  if (specs.length === 0) return
  let next = [...ops]
  for (const spec of specs) {
    if (spec.kind === 'inc') {
      const idx = lastIndexFor(next, spec.counterId)
      const last = idx >= 0 ? next[idx] : null
      if (last && last.kind === 'inc' && last.id !== inFlightId) {
        const n = last.n + spec.n
        if (n === 0) next.splice(idx, 1) // +1 then −1: nothing left to send
        else next[idx] = { ...last, n }
        continue
      }
      next.push({ ...spec, id: crypto.randomUUID() })
    } else {
      next = next.filter((op) => op.counterId !== spec.counterId || op.id === inFlightId)
      next.push({ ...spec, id: crypto.randomUUID() })
    }
  }
  commit(next)
  void flush()
}

// A locally deleted counter takes its queued taps with it (a remote delete is covered by the
// flusher's 404-drop path either way).
export function dropOpsFor(counterId: string): void {
  if (!ops.some((op) => op.counterId === counterId)) return
  commit(ops.filter((op) => op.counterId !== counterId || op.id === inFlightId))
}

export function clearOutbox(): void {
  commit([])
}

// ---- display fold ----

// Displayed value = pending ops replayed over server truth, in queue order: a set rebases,
// incs add. Clamped at 0 to match the server's min (a −1 race can't show a negative).
export function foldValue(
  serverValue: number,
  counterId: string,
  pending: readonly CounterOp[],
): number {
  let value = serverValue
  for (const op of pending) {
    if (op.counterId !== counterId) continue
    value = op.kind === 'set' ? op.value : value + op.n
  }
  return Math.max(0, value)
}

// ---- the flusher ----

function isRetryable(err: unknown): boolean {
  if (!(err instanceof ClientResponseError)) return true // unexpected — keep the op, retry
  if (err.isAbort) return true
  return err.status === 0 || err.status === 401 || err.status >= 500
}

// Remove an op against *fresh* storage state, so a cross-tab append that landed while our
// request was in flight is never clobbered by this write.
function removeOp(opId: string): void {
  syncFromStorage()
  commit(ops.filter((op) => op.id !== opId))
}

async function drain(): Promise<void> {
  let reported = false
  for (;;) {
    syncFromStorage() // another tab may have appended or drained while we awaited
    const op = ops[0]
    if (!op) return
    if (!pb.authStore.isValid) return // paused; the authStore listener resumes us
    inFlightId = op.id
    try {
      const body = op.kind === 'inc' ? { 'value+': op.n } : { value: op.value }
      const record = await pb
        .collection('counters')
        .update<CounterRecord>(op.counterId, body, { requestKey: null })
      // Server truth into the cache BEFORE the op leaves the queue — React batches both
      // notifications, so the folded numeral never dips and recovers.
      applyServerCounter(record)
      removeOp(op.id)
    } catch (err) {
      if (isRetryable(err)) return // network death / abort / 401 — next trigger retries
      // 400/403/404: this op can never land (counter deleted, min-0 race) — drop, move on.
      console.warn('[outbox] dropped op', op, err)
      removeOp(op.id)
      if (!reported) {
        reported = true
        for (const cb of errorListeners) cb("That count couldn't be saved.")
      }
    } finally {
      inFlightId = null
    }
  }
}

async function flush(): Promise<void> {
  if (flushInProgress) return
  if (ops.length === 0) return
  if (!pb.authStore.isValid) return
  if (navigator.onLine === false) return // fail fast in a dead zone; `online` re-triggers
  flushInProgress = true
  try {
    if ('locks' in navigator && navigator.locks) {
      // ifAvailable: if a sibling tab is already draining, let it — our storage listener
      // mirrors its progress, and our next trigger retries the lock if it dies mid-queue.
      await navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (lock) await drain()
      })
    } else {
      await drain() // pre-15.4 Safari: no Web Locks; single-flight per tab still holds
    }
  } finally {
    flushInProgress = false
  }
}

// ---- triggers ----

function updateTick(): void {
  if (ops.length > 0 && tickTimer === null) {
    tickTimer = window.setInterval(() => void flush(), TICK_MS)
  } else if (ops.length === 0 && tickTimer !== null) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

// Called once from main.tsx, before render.
export function initOutbox(): void {
  if (initialized) return
  initialized = true
  currentOwner = pb.authStore.record?.id ?? null
  syncFromStorage()

  window.addEventListener('online', () => void flush())
  window.addEventListener('focus', () => void flush())
  // Not in SPEC §11's trigger list, but iOS Safari fires visibilitychange far more reliably
  // than focus on PWA return (DECISIONS 2026-07-13).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush()
  })
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) syncFromStorage()
  })

  pb.authStore.onChange(() => {
    const id = pb.authStore.record?.id ?? null
    if (id !== currentOwner) {
      currentOwner = id
      lastRaw = undefined // force a re-parse under the new account's owner check
      if (id === null) clearOutbox() // logout / failed boot refresh: stale taps die here
      else syncFromStorage()
    }
    if (id !== null) void flush() // login or token refresh resumes a paused queue
  })

  void flush()
}

// ---- React bindings ----

function subscribeQueue(cb: () => void): () => void {
  queueListeners.add(cb)
  return () => queueListeners.delete(cb)
}

export function usePendingOps(): readonly QueuedOp[] {
  return useSyncExternalStore(subscribeQueue, () => ops)
}

// Drives the tiny "syncing" stitch (DESIGN §10): visible while anything is queued.
export function useOutboxSyncing(): boolean {
  return useSyncExternalStore(subscribeQueue, () => ops.length > 0)
}

// Rare drops (counter deleted remotely, a min-0 race) surface as one toast per flush run;
// whichever counter screen is mounted subscribes and shows it.
export function subscribeOutboxErrors(cb: (message: string) => void): () => void {
  errorListeners.add(cb)
  return () => errorListeners.delete(cb)
}
