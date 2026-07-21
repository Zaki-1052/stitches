// web/src/features/yarn/mutations.ts — write-side hooks, mirroring patterns/mutations.ts:
// full-form saves invalidate and let fresh reads win; the detail page's visibility toggle goes
// through the optimistic variant so the UI answers instantly and reconciles on settle.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import type { YarnRecord } from '../../lib/schema.ts'
import { projectKeys } from '../projects/queries.ts'
import { yarnKeys } from './queries.ts'

export function useCreateYarn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: FormData) => pb.collection('yarns').create<YarnRecord>(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: yarnKeys.lists() })
    },
  })
}

export function useUpdateYarn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormData }) =>
      pb.collection('yarns').update<YarnRecord>(id, body),
    onSuccess: (_updated, { id }) => {
      void queryClient.invalidateQueries({ queryKey: yarnKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: yarnKeys.lists() })
    },
  })
}

// Optimistic single-field updates (plain JSON body, e.g. { visibility: 'friends' }): the detail
// cache flips in onMutate, rolls back on error, and reconciles with the server on settle.
export function useQuickUpdateYarn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<YarnRecord> }) =>
      pb.collection('yarns').update<YarnRecord>(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: yarnKeys.detail(id) })
      const previous = queryClient.getQueryData<YarnRecord>(yarnKeys.detail(id))
      if (previous) queryClient.setQueryData(yarnKeys.detail(id), { ...previous, ...body })
      return { previous }
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(yarnKeys.detail(id), context.previous)
    },
    onSettled: (_updated, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: yarnKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: yarnKeys.lists() })
    },
  })
}

export function useDeleteYarn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => pb.collection('yarns').delete(id),
    onSuccess: (_ok, id) => {
      queryClient.removeQueries({ queryKey: yarnKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: yarnKeys.lists() })
      // Quiet unlink (ADDONS §2.2): the server silently removed this id from every linked
      // project's yarns array, so every cached project read is stale now.
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
