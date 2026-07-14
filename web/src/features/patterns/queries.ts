// web/src/features/patterns/queries.ts — read-side hooks for the library (SPEC §12: all server
// state in TanStack Query over the PB singleton). Keys are namespaced per collection; project
// and journal reads live in features/projects/queries.ts.
//
// The Library hard-filters `owner = viewer` even though the PB list rule would also return
// friends-shared records: this screen is *your* shelf; the Friends feed (Phase 4) is where
// shared patterns surface.
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import type { PatternRecord, TagRecord } from '../../lib/schema.ts'
import type { LibraryFilters } from './urlParams.ts'

export const patternKeys = {
  all: ['patterns'] as const,
  lists: () => [...patternKeys.all, 'list'] as const,
  list: (viewerId: string, filters: LibraryFilters) =>
    [...patternKeys.lists(), viewerId, filters] as const,
  // Nested under lists() so every existing pattern-mutation invalidation catches it too.
  options: (viewerId: string) => [...patternKeys.lists(), 'options', viewerId] as const,
  recent: (viewerId: string, limit: number) =>
    [...patternKeys.lists(), 'recent', viewerId, limit] as const,
  details: () => [...patternKeys.all, 'detail'] as const,
  detail: (id: string) => [...patternKeys.details(), id] as const,
}

export const tagKeys = {
  all: ['tags'] as const,
  list: (viewerId: string) => [...tagKeys.all, 'list', viewerId] as const,
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

// Home's "recently added" strip (DESIGN §9) — one lean page, not the full library.
export function useRecentPatterns(limit: number) {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: patternKeys.recent(viewerId, limit),
    enabled: viewerId !== '',
    queryFn: async () => {
      const page = await pb.collection('patterns').getList<PatternRecord>(1, limit, {
        filter: pb.filter('owner = {:me}', { me: viewerId }),
        sort: '-created',
        expand: 'tags',
      })
      return page.items
    },
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

// Lean projection feeding the project form's pattern <select>.
export interface PatternOption {
  id: string
  title: string
}

export function usePatternOptions() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: patternKeys.options(viewerId),
    enabled: viewerId !== '',
    queryFn: () =>
      pb.collection('patterns').getFullList<PatternOption>({
        filter: pb.filter('owner = {:me}', { me: viewerId }),
        fields: 'id,title',
        sort: '-updated',
      }),
  })
}
