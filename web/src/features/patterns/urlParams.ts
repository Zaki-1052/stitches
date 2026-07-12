// web/src/features/patterns/urlParams.ts — the Library's URL is its state (SPEC §7.9, PLAN 1.2):
// ?q=&shelf=&craft=&weight=&tags=&view=list, multi-value groups comma-joined. Parsing is
// defensive — unknown values from stale bookmarks or hand-edited URLs are dropped, never crash
// the chip row. Tag ids aren't validated here; a stale id simply matches no patterns and no chip.
import { CRAFTS, SHELVES, YARN_WEIGHTS } from '../../lib/schema.ts'
import type { Craft, Shelf, YarnWeight } from '../../lib/schema.ts'

export interface LibraryFilters {
  q: string
  shelf: Shelf[]
  craft: Craft[]
  weight: YarnWeight[]
  tags: string[]
}

export type LibraryView = 'grid' | 'list'

export interface LibraryParams {
  filters: LibraryFilters
  view: LibraryView
}

export const EMPTY_FILTERS: LibraryFilters = { q: '', shelf: [], craft: [], weight: [], tags: [] }

function parseGroup<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  const seen = new Set<T>()
  for (const value of raw.split(',')) {
    if ((allowed as readonly string[]).includes(value)) seen.add(value as T)
  }
  return [...seen]
}

export function parseLibraryParams(searchParams: URLSearchParams): LibraryParams {
  return {
    filters: {
      q: searchParams.get('q') ?? '',
      shelf: parseGroup(searchParams.get('shelf'), SHELVES),
      craft: parseGroup(searchParams.get('craft'), CRAFTS),
      weight: parseGroup(searchParams.get('weight'), YARN_WEIGHTS),
      tags: (searchParams.get('tags') ?? '').split(',').filter(Boolean),
    },
    view: searchParams.get('view') === 'list' ? 'list' : 'grid',
  }
}

// Only non-defaults land in the URL, so a pristine Library is plain /patterns.
export function serializeLibraryParams({ filters, view }: LibraryParams): URLSearchParams {
  const out = new URLSearchParams()
  if (filters.q) out.set('q', filters.q)
  if (filters.shelf.length) out.set('shelf', filters.shelf.join(','))
  if (filters.craft.length) out.set('craft', filters.craft.join(','))
  if (filters.weight.length) out.set('weight', filters.weight.join(','))
  if (filters.tags.length) out.set('tags', filters.tags.join(','))
  if (view === 'list') out.set('view', 'list')
  return out
}

// Count of active filter *selections* (search text excluded) — the badge on the Filters chip.
export function countActiveFilters(filters: LibraryFilters): number {
  return filters.shelf.length + filters.craft.length + filters.weight.length + filters.tags.length
}

export function hasAnyQuery(filters: LibraryFilters): boolean {
  return filters.q !== '' || countActiveFilters(filters) > 0
}
