// web/src/features/projects/queries.ts — read-side hooks for the journal half (SPEC §12).
// Everything hangs off the single ['projects'] root, so one invalidation of projectKeys.all
// refreshes lists, details, the library's made-✓ badge, and the pattern-delete pre-check.
//
// Like the Library, the projects list hard-filters `owner = viewer`: this screen is *your*
// basket; friends' shared projects surface in the Phase 4 feed.
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import type {
  JournalEntryRecord,
  ProjectLinkRecord,
  ProjectRecord,
  ProjectStatus,
} from '../../lib/schema.ts'

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (viewerId: string, status: ProjectStatus | null) =>
    [...projectKeys.lists(), viewerId, status ?? 'all'] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  finishedPatternIds: (viewerId: string) =>
    [...projectKeys.all, 'finishedPatternIds', viewerId] as const,
  linkedToPattern: (patternId: string) =>
    [...projectKeys.all, 'linkedToPattern', patternId] as const,
}

export const entryKeys = {
  all: ['journal_entries'] as const,
  forProject: (projectId: string) => [...entryKeys.all, 'project', projectId] as const,
}

export function useProjects(status: ProjectStatus | null) {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: projectKeys.list(viewerId, status),
    enabled: viewerId !== '',
    queryFn: () => {
      const parts = [pb.filter('owner = {:me}', { me: viewerId })]
      if (status) parts.push(pb.filter('status = {:status}', { status }))
      return pb.collection('projects').getFullList<ProjectRecord>({
        filter: parts.join(' && '),
        sort: '-updated',
        expand: 'pattern',
      })
    },
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    enabled: id !== '',
    queryFn: () => pb.collection('projects').getOne<ProjectRecord>(id, { expand: 'pattern' }),
  })
}

// The diary feed. `-entry_date` puts backdated entries where they belong; `-created` breaks
// same-day ties so two entries written today keep their writing order.
export function useJournalEntries(projectId: string) {
  return useQuery({
    queryKey: entryKeys.forProject(projectId),
    enabled: projectId !== '',
    queryFn: () =>
      pb.collection('journal_entries').getFullList<JournalEntryRecord>({
        filter: pb.filter('project = {:id}', { id: projectId }),
        sort: '-entry_date,-created',
      }),
  })
}

// SPEC §7.9 made-✓: a pattern counts as made when any *visible* project on it is finished.
// Rules already scope "visible" to own + friends-shared.
export function useFinishedPatternIds() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: projectKeys.finishedPatternIds(viewerId),
    enabled: viewerId !== '',
    queryFn: async () => {
      const rows = await pb.collection('projects').getFullList<ProjectLinkRecord>({
        filter: 'status = "finished" && pattern != ""',
        fields: 'id,pattern,status,name',
      })
      return new Set(rows.map((row) => row.pattern))
    },
  })
}

// Delete pre-check and the pattern detail's projects section: viewer-visible projects linked
// to this pattern. A friend's private project can block deletion invisibly — the mutation's
// 400 fallback covers that case.
export function useLinkedProjects(patternId: string) {
  return useQuery({
    queryKey: projectKeys.linkedToPattern(patternId),
    enabled: patternId !== '',
    queryFn: () =>
      pb.collection('projects').getFullList<ProjectLinkRecord>({
        filter: pb.filter('pattern = {:id}', { id: patternId }),
        fields: 'id,pattern,status,name',
      }),
  })
}
