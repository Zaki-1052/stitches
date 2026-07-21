// web/src/features/yarn/urlParams.ts — the stash's URL is its state (ADDONS §2.3), a trimmed
// mirror of the Library's: ?q=&weight=, weights comma-joined. Parsing is defensive — unknown
// values from stale bookmarks or hand-edited URLs are dropped, never crash the chip row.
import { YARN_WEIGHTS } from '../../lib/schema.ts'
import type { YarnWeight } from '../../lib/schema.ts'

export interface YarnFilters {
  q: string
  weight: YarnWeight[]
}

export const EMPTY_YARN_FILTERS: YarnFilters = { q: '', weight: [] }

function parseGroup<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  const seen = new Set<T>()
  for (const value of raw.split(',')) {
    if ((allowed as readonly string[]).includes(value)) seen.add(value as T)
  }
  return [...seen]
}

export function parseYarnParams(searchParams: URLSearchParams): YarnFilters {
  return {
    q: searchParams.get('q') ?? '',
    weight: parseGroup(searchParams.get('weight'), YARN_WEIGHTS),
  }
}

// Only non-defaults land in the URL, so a pristine stash is plain /yarn.
export function serializeYarnParams(filters: YarnFilters): URLSearchParams {
  const out = new URLSearchParams()
  if (filters.q) out.set('q', filters.q)
  if (filters.weight.length) out.set('weight', filters.weight.join(','))
  return out
}

// Count of active filter *selections* (search text excluded) — the badge on the Filters chip.
export function countActiveYarnFilters(filters: YarnFilters): number {
  return filters.weight.length
}

export function hasAnyYarnQuery(filters: YarnFilters): boolean {
  return filters.q !== '' || countActiveYarnFilters(filters) > 0
}
