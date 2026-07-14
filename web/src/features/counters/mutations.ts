// web/src/features/counters/mutations.ts — write-side hooks for counter METADATA (label,
// target, resets_with) plus create/delete. The value field never travels through these:
// SPEC §11 routes every value change through the outbox (lib/outbox.ts) so offline taps,
// atomic increments, and linked resets stay in one ordered queue. These PATCHes keep the
// SDK's default requestKey — the flusher opts out on its side, so the two can't cancel
// each other.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import { dropOpsFor } from '../../lib/outbox.ts'
import type { CounterRecord } from '../../lib/schema.ts'
import { applyServerCounter, counterKeys, removeCounterFromCache } from './queries.ts'

// PB zero values carry the "not set" meaning: target 0 = no target, resets_with '' = clears
// the link.
export interface CounterMetaBody {
  label: string
  target: number
  resets_with: string
}

export function useCreateCounter() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ projectId, body }: { projectId: string; body: CounterMetaBody }) =>
      pb.collection('counters').create<CounterRecord>({
        owner: user?.id,
        project: projectId,
        value: 0, // PB v0.39 has no schema-level defaults (DECISIONS 2026-07-11)
        ...body,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: counterKeys.all })
    },
  })
}

// Never sends project or owner — the API rules lock both anyway (:changed / owner-lock).
export function useUpdateCounterMeta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CounterMetaBody }) =>
      pb.collection('counters').update<CounterRecord>(id, body),
    onSuccess: (updated) => {
      applyServerCounter(updated) // instant; the monotonic guard settles flusher races
      void queryClient.invalidateQueries({ queryKey: counterKeys.all })
    },
  })
}

export function useDeleteCounter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      pb.collection('counters').delete(id),
    onSuccess: (_ok, { id, projectId }) => {
      dropOpsFor(id) // queued taps for a deleted counter would only 404 in the flusher
      removeCounterFromCache({ id, project: projectId })
      void queryClient.invalidateQueries({ queryKey: counterKeys.all })
    },
  })
}
