// web/src/features/counters/queries.ts — read-side hooks and the shared server-truth cache
// writer for counters (SPEC §11). The query cache holds SERVER truth only: refetches, realtime
// events, and flush responses all write here freely, and the outbox overlays pending taps at
// render time (lib/outbox.ts foldValue). applyServerCounter is the single funnel for
// out-of-band server records, with a monotonic `updated` guard so a stale realtime echo can
// never roll a fresher flush response back.
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import { queryClient } from '../shared/queryClient.ts'
import type { CounterRecord } from '../../lib/schema.ts'

export const counterKeys = {
  all: ['counters'] as const,
  forProject: (projectId: string) => [...counterKeys.all, 'project', projectId] as const,
  mine: (viewerId: string) => [...counterKeys.all, 'mine', viewerId] as const,
}

// A project's counters, oldest first — the stable pager order. Rules scope the list to the
// owner, so a friend opening a shared project simply gets an empty list (the UI never renders
// counter chrome for non-owners anyway).
export function useCounters(projectId: string) {
  return useQuery({
    queryKey: counterKeys.forProject(projectId),
    enabled: projectId !== '',
    queryFn: () =>
      pb.collection('counters').getFullList<CounterRecord>({
        filter: pb.filter('project = {:id}', { id: projectId }),
        sort: 'created',
      }),
  })
}

// Every counter the viewer owns, for the /projects progress bars — grouped per project
// client-side (one query beats one-per-card; counters are tiny records).
export function useMyCounters() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: counterKeys.mine(viewerId),
    enabled: viewerId !== '',
    queryFn: () =>
      pb.collection('counters').getFullList<CounterRecord>({
        filter: pb.filter('owner = {:me}', { me: viewerId }),
        sort: 'created',
      }),
  })
}

// lib/sync.ts fetch (ADDONS §3.3): the viewer's counters, mine-key shape. Own requestKey per
// DECISIONS 2026-07-19.
export function fetchMyCountersForSync(viewerId: string): Promise<CounterRecord[]> {
  return pb.collection('counters').getFullList<CounterRecord>({
    filter: pb.filter('owner = {:me}', { me: viewerId }),
    sort: 'created',
    requestKey: 'sync:counters',
  })
}

// Skips when the cached row is fresher (PB `updated` is ms-precision and lexicographically
// ordered); inserts keep created-asc order so a realtime create lands where the pager expects
// it. No-op when the list isn't cached — the next mount refetches anyway.
function upsertCounter(
  old: CounterRecord[] | undefined,
  record: CounterRecord,
): CounterRecord[] | undefined {
  if (!old) return old
  const existing = old.find((c) => c.id === record.id)
  if (existing && existing.updated > record.updated) return old
  if (!existing) {
    return [...old, record].sort((a, b) => (a.created < b.created ? -1 : 1))
  }
  return old.map((c) => (c.id === record.id ? record : c))
}

// Upsert a server record into BOTH lists that hold it: the project's (the counter surface)
// and the viewer's `mine` list (home hero + /projects progress bars). Mirroring into `mine`
// closes the queryClient staleTime hole: count on the surface, go home within 30 s — the ops
// have flushed and drained, so only a funneled cache keeps the hero value fresh.
export function applyServerCounter(record: CounterRecord) {
  queryClient.setQueryData<CounterRecord[]>(counterKeys.forProject(record.project), (old) =>
    upsertCounter(old, record),
  )
  queryClient.setQueryData<CounterRecord[]>(counterKeys.mine(record.owner), (old) =>
    upsertCounter(old, record),
  )
}

// `owner` is optional so useDeleteCounter's {id, project} call keeps working — a viewer only
// ever deletes their own counters, so the authStore id is the right `mine` key there.
export function removeCounterFromCache(record: { id: string; project: string; owner?: string }) {
  queryClient.setQueryData<CounterRecord[]>(counterKeys.forProject(record.project), (old) =>
    old?.filter((c) => c.id !== record.id),
  )
  const owner = record.owner ?? pb.authStore.record?.id ?? ''
  if (owner !== '') {
    queryClient.setQueryData<CounterRecord[]>(counterKeys.mine(owner), (old) =>
      old?.filter((c) => c.id !== record.id),
    )
  }
}
