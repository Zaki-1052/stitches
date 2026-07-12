// web/src/features/patterns/mutations.ts — write-side hooks. Full-form saves invalidate and let
// fresh reads win; the detail page's quick taps (shelf pill, visibility toggle) go through the
// optimistic variant so the UI answers instantly and reconciles on settle.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import type { PatternRecord, TagFormValues, TagRecord } from '../../lib/schema.ts'
import { patternKeys, tagKeys } from './queries.ts'

export function useCreatePattern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: FormData) => pb.collection('patterns').create<PatternRecord>(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patternKeys.lists() })
    },
  })
}

export function useUpdatePattern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormData }) =>
      pb.collection('patterns').update<PatternRecord>(id, body),
    onSuccess: (_updated, { id }) => {
      void queryClient.invalidateQueries({ queryKey: patternKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: patternKeys.lists() })
    },
  })
}

// Optimistic single-field updates (plain JSON body, e.g. { shelf: 'queued' }): the detail cache
// flips in onMutate, rolls back on error, and reconciles with the server on settle.
export function useQuickUpdatePattern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<PatternRecord> }) =>
      pb.collection('patterns').update<PatternRecord>(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: patternKeys.detail(id) })
      const previous = queryClient.getQueryData<PatternRecord>(patternKeys.detail(id))
      if (previous) queryClient.setQueryData(patternKeys.detail(id), { ...previous, ...body })
      return { previous }
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(patternKeys.detail(id), context.previous)
    },
    onSettled: (_updated, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: patternKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: patternKeys.lists() })
    },
  })
}

export function useDeletePattern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => pb.collection('patterns').delete(id),
    onSuccess: (_ok, id) => {
      queryClient.removeQueries({ queryKey: patternKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: patternKeys.lists() })
    },
  })
}

export function useCreateTag() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (values: TagFormValues) =>
      pb.collection('tags').create<TagRecord>({ ...values, owner: user?.id ?? '' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all })
    },
  })
}
