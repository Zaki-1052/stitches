// web/src/features/projects/mutations.ts — write-side hooks for projects and journal entries,
// mirroring the patterns shapes. Everything invalidates through projectKeys.all: lists, the
// detail, the library's made-✓ badge, and the pattern-delete pre-check all refresh together.
// Quick taps (status sheet, summary save, visibility toggle) go through the optimistic variant
// so the UI answers instantly and reconciles on settle.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import type { JournalEntryRecord, ProjectRecord } from '../../lib/schema.ts'
import { entryKeys, projectKeys } from './queries.ts'

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: FormData) => pb.collection('projects').create<ProjectRecord>(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormData }) =>
      pb.collection('projects').update<ProjectRecord>(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

// Optimistic single-field updates (plain JSON body, e.g. { status: 'finished' }): the detail
// cache flips in onMutate, rolls back on error, and reconciles with the server on settle.
export function useQuickUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ProjectRecord> }) =>
      pb.collection('projects').update<ProjectRecord>(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) })
      const previous = queryClient.getQueryData<ProjectRecord>(projectKeys.detail(id))
      if (previous) queryClient.setQueryData(projectKeys.detail(id), { ...previous, ...body })
      return { previous }
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(projectKeys.detail(id), context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => pb.collection('projects').delete(id),
    onSuccess: (_ok, id) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) })
      // Entries cascade server-side (SPEC §7: a project's diary dies with it).
      queryClient.removeQueries({ queryKey: entryKeys.forProject(id) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useCreateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body }: { projectId: string; body: FormData }) =>
      pb.collection('journal_entries').create<JournalEntryRecord>(body),
    onSuccess: (_created, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.forProject(projectId) })
    },
  })
}

export function useUpdateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; projectId: string; body: FormData }) =>
      pb.collection('journal_entries').update<JournalEntryRecord>(id, body),
    onSuccess: (_updated, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.forProject(projectId) })
    },
  })
}

export function useDeleteEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      pb.collection('journal_entries').delete(id),
    onSuccess: (_ok, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.forProject(projectId) })
    },
  })
}
