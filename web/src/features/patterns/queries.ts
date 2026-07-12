// web/src/features/patterns/queries.ts — read-side hooks for the library (SPEC §12: all server
// state in TanStack Query over the PB singleton). Keys are namespaced per collection; project
// keys live under 'projects' so Session 2.1's status mutations can invalidate them later.
//
// The Library hard-filters `owner = viewer` even though the PB list rule would also return
// friends-shared records: this screen is *your* shelf; the Friends feed (Phase 4) is where
// shared patterns surface.
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import type { PatternRecord, ProjectLinkRecord, TagRecord } from '../../lib/schema.ts'
import type { LibraryFilters } from './urlParams.ts'

export const patternKeys = {
  all: ['patterns'] as const,
  lists: () => [...patternKeys.all, 'list'] as const,
  list: (viewerId: string, filters: LibraryFilters) =>
    [...patternKeys.lists(), viewerId, filters] as const,
  details: () => [...patternKeys.all, 'detail'] as const,
  detail: (id: string) => [...patternKeys.details(), id] as const,
}

export const tagKeys = {
  all: ['tags'] as const,
  list: (viewerId: string) => [...tagKeys.all, 'list', viewerId] as const,
}

export const projectKeys = {
  all: ['projects'] as const,
  finishedPatternIds: (viewerId: string) =>
    [...projectKeys.all, 'finishedPatternIds', viewerId] as const,
  linkedToPattern: (patternId: string) =>
    [...projectKeys.all, 'linkedToPattern', patternId] as const,
}

// OR-joins one filter template (`{:value}` placeholder) across a group's selected values —
// within a filter group, any match qualifies.
function anyOf(template: string, values: readonly string[]): string {
  return '(' + values.map((value) => pb.filter(template, { value })).join(' || ') + ')'
}

function buildLibraryFilter(viewerId: string, f: LibraryFilters): string {
  const parts = [pb.filter('owner = {:me}', { me: viewerId })]
  if (f.q) parts.push(pb.filter('(title ~ {:q} || designer ~ {:q})', { q: f.q }))
  if (f.shelf.length) parts.push(anyOf('shelf = {:value}', f.shelf))
  if (f.craft.length) parts.push(anyOf('craft = {:value}', f.craft))
  if (f.weight.length) parts.push(anyOf('yarn_weight = {:value}', f.weight))
  // `?=` is PB's any-of operator for multi-relations: carries any selected tag.
  if (f.tags.length) parts.push(anyOf('tags.id ?= {:value}', f.tags))
  return parts.join(' && ')
}

export function usePatterns(filters: LibraryFilters) {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: patternKeys.list(viewerId, filters),
    enabled: viewerId !== '',
    queryFn: () =>
      pb.collection('patterns').getFullList<PatternRecord>({
        filter: buildLibraryFilter(viewerId, filters),
        sort: '-updated',
        expand: 'tags',
      }),
  })
}

export function usePattern(id: string) {
  return useQuery({
    queryKey: patternKeys.detail(id),
    enabled: id !== '',
    queryFn: () => pb.collection('patterns').getOne<PatternRecord>(id, { expand: 'tags' }),
  })
}

export function useTags() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: tagKeys.list(viewerId),
    enabled: viewerId !== '',
    queryFn: () =>
      pb.collection('tags').getFullList<TagRecord>({
        filter: pb.filter('owner = {:me}', { me: viewerId }),
        sort: 'name',
      }),
  })
}

// SPEC §7.9 made-✓: a pattern counts as made when any *visible* project on it is finished.
// Rules already scope "visible" to own + friends-shared; empty until Phase 2 builds projects.
export function useFinishedPatternIds() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: projectKeys.finishedPatternIds(viewerId),
    enabled: viewerId !== '',
    queryFn: async () => {
      const rows = await pb.collection('projects').getFullList<ProjectLinkRecord>({
        filter: 'status = "finished" && pattern != ""',
        fields: 'id,pattern,status',
      })
      return new Set(rows.map((row) => row.pattern))
    },
  })
}

// Delete pre-check: viewer-visible projects still linked to this pattern. A friend's private
// project can block deletion invisibly — the mutation's 400 fallback covers that case.
export function useLinkedProjects(patternId: string) {
  return useQuery({
    queryKey: projectKeys.linkedToPattern(patternId),
    enabled: patternId !== '',
    queryFn: () =>
      pb.collection('projects').getFullList<ProjectLinkRecord>({
        filter: pb.filter('pattern = {:id}', { id: patternId }),
        fields: 'id,pattern,status',
      }),
  })
}
