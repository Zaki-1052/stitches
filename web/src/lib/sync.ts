// web/src/lib/sync.ts — full-library proactive sync (ADDONS §3.3), in the outbox mold: module
// init from main.tsx, storage-backed owner-scoped state, useSyncExternalStore hook. One sweep
// fetches the canonical unfiltered list per collection into the EXACT queryKeys the route hooks
// mount (load-bearing: a mismatched key silently defeats offline browse for that collection),
// seeds every per-record detail cache from the list rows, groups one journal sweep into
// per-project caches, and warms the SW thumbnail cache — so any record's detail opens offline
// without ever having been visited.
//
// Triggers: boot authRefresh success (lib/auth.tsx, forced) · Settings "Sync now" (forced) ·
// the window `online` event, gated by SYNC_MIN_INTERVAL_MS so flaky-signal blips don't re-sync
// in a loop. A partial failure keeps everything already seeded — strictly better than nothing —
// and surfaces the approved error line through useSyncStatus().
//
// Known v1 limit (DECISIONS at build): a filter/search combination never run online shows the
// normal paused/cached-less state offline — server-side filtering isn't replayed client-side.
// The unfiltered browse, every detail, and every journal are the guarantee.
//
// Layering note: lib/ importing from features/ is inverted but acyclic — the outbox precedent
// (SPEC §6 pins these modules at lib/; query keys live with their features).
import { useSyncExternalStore } from 'react'
import { pb } from './pb.ts'
import type { CounterRecord, JournalEntryRecord } from './schema.ts'
import { thumbUrl } from './files.ts'
import { queryClient } from '../features/shared/queryClient.ts'
import {
  fetchPatternsForSync,
  fetchTagsForSync,
  patternKeys,
  tagKeys,
} from '../features/patterns/queries.ts'
import {
  entryKeys,
  fetchAllJournalEntriesForSync,
  fetchProjectsForSync,
  projectKeys,
} from '../features/projects/queries.ts'
import { counterKeys, fetchMyCountersForSync } from '../features/counters/queries.ts'
import { fetchFriendsFeedForSync, friendsKeys } from '../features/friends/queries.ts'
import { fetchYarnsForSync, yarnKeys } from '../features/yarn/queries.ts'
import { EMPTY_FILTERS } from '../features/patterns/urlParams.ts'
import { EMPTY_YARN_FILTERS } from '../features/yarn/urlParams.ts'

const STORAGE_KEY = 'stitches:sync:v1'
const SYNC_MIN_INTERVAL_MS = 10 * 60 * 1000

let lastSyncedAt: string | null = null
let inProgress = false
let error: string | null = null
let initialized = false

const listeners = new Set<() => void>()

function emit(): void {
  for (const cb of listeners) cb()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// Owner-scoped persistence, the outbox parseQueue idiom: another account's stamp (or an
// unreadable one) is discarded, never inherited.
function load(): void {
  lastSyncedAt = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return
    const parsed = JSON.parse(raw) as { ownerId?: string; lastSyncedAt?: string }
    if (parsed.ownerId === pb.authStore.record?.id && typeof parsed.lastSyncedAt === 'string') {
      lastSyncedAt = parsed.lastSyncedAt
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function save(): void {
  const ownerId = pb.authStore.record?.id
  if (!ownerId || !lastSyncedAt) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerId, lastSyncedAt }))
}

// Called once from main.tsx at module scope (StrictMode doubles effects, not modules).
export function initSync(): void {
  if (initialized) return
  initialized = true
  load()
  // Identity change (login/logout) re-scopes the stamp — the outbox onChange idiom.
  pb.authStore.onChange(() => {
    load()
    emit()
  })
  window.addEventListener('online', () => void triggerSync())
}

export function useSyncStatus(): {
  lastSyncedAt: string | null
  inProgress: boolean
  error: string | null
} {
  const at = useSyncExternalStore(subscribe, () => lastSyncedAt)
  const busy = useSyncExternalStore(subscribe, () => inProgress)
  const err = useSyncExternalStore(subscribe, () => error)
  return { lastSyncedAt: at, inProgress: busy, error: err }
}

export async function triggerSync(opts: { force?: boolean } = {}): Promise<void> {
  const viewerId = pb.authStore.record?.id ?? ''
  if (viewerId === '' || inProgress || !navigator.onLine) return
  if (!opts.force && lastSyncedAt !== null) {
    if (Date.now() - new Date(lastSyncedAt).getTime() < SYNC_MIN_INTERVAL_MS) return
  }
  inProgress = true
  error = null
  emit()
  try {
    await runSync(viewerId)
    lastSyncedAt = new Date().toISOString()
    save()
  } catch (err_) {
    // Steps already completed stay seeded — a partial sync is kept, only the stamp isn't.
    console.error('[sync]', err_)
    error = "Sync didn't finish. Try again?"
  } finally {
    inProgress = false
    emit()
  }
}

async function runSync(viewerId: string): Promise<void> {
  // fetchQuery with staleTime 0 always hits the server and lands the result in the cache under
  // the same key the route hook mounts.
  const patterns = await queryClient.fetchQuery({
    queryKey: patternKeys.list(viewerId, EMPTY_FILTERS),
    queryFn: () => fetchPatternsForSync(viewerId),
    staleTime: 0,
  })
  for (const p of patterns) queryClient.setQueryData(patternKeys.detail(p.id), p)

  const projects = await queryClient.fetchQuery({
    queryKey: projectKeys.list(viewerId, null),
    queryFn: () => fetchProjectsForSync(viewerId),
    staleTime: 0,
  })
  for (const p of projects) queryClient.setQueryData(projectKeys.detail(p.id), p)

  await queryClient.fetchQuery({
    queryKey: tagKeys.list(viewerId),
    queryFn: () => fetchTagsForSync(viewerId),
    staleTime: 0,
  })

  const yarns = await queryClient.fetchQuery({
    queryKey: yarnKeys.list(viewerId, EMPTY_YARN_FILTERS),
    queryFn: () => fetchYarnsForSync(viewerId),
    staleTime: 0,
  })
  for (const y of yarns) queryClient.setQueryData(yarnKeys.detail(y.id), y)

  // Counters (mine): also grouped into each project's own list so the counting surface opens
  // offline. Server truth only — the outbox overlays pending taps at render time.
  const counters = await queryClient.fetchQuery({
    queryKey: counterKeys.mine(viewerId),
    queryFn: () => fetchMyCountersForSync(viewerId),
    staleTime: 0,
  })
  const countersByProject = new Map<string, CounterRecord[]>()
  for (const counter of counters) {
    const group = countersByProject.get(counter.project)
    if (group) group.push(counter)
    else countersByProject.set(counter.project, [counter])
  }
  for (const [projectId, group] of countersByProject) {
    queryClient.setQueryData(counterKeys.forProject(projectId), group)
  }

  // Friends feed — and the friend-shared records' detail caches, so a feed card's detail opens
  // offline too (the expands match the detail hooks' shapes; see fetchFeed).
  const feed = await queryClient.fetchQuery({
    queryKey: friendsKeys.feed(viewerId),
    queryFn: () => fetchFriendsFeedForSync(viewerId),
    staleTime: 0,
  })
  for (const item of feed) {
    if (item.kind === 'pattern') {
      queryClient.setQueryData(patternKeys.detail(item.pattern.id), item.pattern)
    } else {
      queryClient.setQueryData(projectKeys.detail(item.project.id), item.project)
    }
  }

  // One journal sweep, grouped per project. Projects with no entries get an explicit empty
  // cache so their journal section renders settled offline instead of pending forever.
  const entries = await fetchAllJournalEntriesForSync()
  const entriesByProject = new Map<string, JournalEntryRecord[]>()
  for (const entry of entries) {
    const group = entriesByProject.get(entry.project)
    if (group) group.push(entry)
    else entriesByProject.set(entry.project, [entry])
  }
  for (const [projectId, group] of entriesByProject) {
    queryClient.setQueryData(entryKeys.forProject(projectId), group)
  }
  const knownProjectIds = [...projects.map((p) => p.id), ...feed.flatMap((item) => (item.kind === 'finished_object' ? [item.project.id] : []))]
  for (const projectId of knownProjectIds) {
    if (!entriesByProject.has(projectId)) queryClient.setQueryData(entryKeys.forProject(projectId), [])
  }

  await warmThumbnails({ patterns, projects, yarns, entries, feed })
}

// ADDONS §3.4: the SW's CacheFirst matches EXACT URL strings, so warming requests the identical
// thumb sizes the runtime components request (all via lib/files.ts) — a different size would
// just move the cache miss offline instead of removing it.
async function warmThumbnails({
  patterns,
  projects,
  yarns,
  entries,
  feed,
}: {
  patterns: Awaited<ReturnType<typeof fetchPatternsForSync>>
  projects: Awaited<ReturnType<typeof fetchProjectsForSync>>
  yarns: Awaited<ReturnType<typeof fetchYarnsForSync>>
  entries: JournalEntryRecord[]
  feed: Awaited<ReturnType<typeof fetchFriendsFeedForSync>>
}): Promise<void> {
  // Without an active SW there is no thumbnail cache to warm (dev, or first load before the
  // SW controls the page) — skip the request burst.
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return

  const urls = new Set<string>()
  const addUser = (user?: { avatar: string } | null) => {
    if (user?.avatar) urls.add(thumbUrl(user, user.avatar, 'chip'))
  }

  for (const p of patterns) {
    if (p.thumbnail) {
      urls.add(thumbUrl(p, p.thumbnail, 'grid'))
      urls.add(thumbUrl(p, p.thumbnail, 'hero'))
    }
    for (const photo of p.photos) urls.add(thumbUrl(p, photo, 'grid'))
  }
  for (const p of projects) {
    if (p.cover) {
      urls.add(thumbUrl(p, p.cover, 'grid'))
      urls.add(thumbUrl(p, p.cover, 'hero'))
    }
  }
  for (const y of yarns) {
    if (y.photos[0]) {
      urls.add(thumbUrl(y, y.photos[0], 'chip'))
      urls.add(thumbUrl(y, y.photos[0], 'grid'))
      urls.add(thumbUrl(y, y.photos[0], 'hero'))
    }
    for (const photo of y.photos.slice(1)) urls.add(thumbUrl(y, photo, 'grid'))
  }
  for (const entry of entries) {
    for (const photo of entry.photos) urls.add(thumbUrl(entry, photo, 'grid'))
  }
  for (const item of feed) {
    if (item.kind === 'pattern') {
      const p = item.pattern
      if (p.thumbnail) {
        urls.add(thumbUrl(p, p.thumbnail, 'grid'))
        urls.add(thumbUrl(p, p.thumbnail, 'hero'))
      }
      for (const photo of p.photos) urls.add(thumbUrl(p, photo, 'grid'))
      addUser(p.expand?.owner)
    } else {
      const p = item.project
      if (p.cover) {
        urls.add(thumbUrl(p, p.cover, 'grid'))
        urls.add(thumbUrl(p, p.cover, 'hero'))
      }
      addUser(p.expand?.owner)
    }
  }

  // Fire the GETs and let the SW store what lands; individual misses are not a sync failure.
  await Promise.allSettled([...urls].map((url) => fetch(url)))
}
