// web/src/routes/LibraryPage.tsx — the Library (/patterns, DESIGN §9): sticky search, filter
// chips → bottom sheet, grid/list toggle, all state in URL search params. Every in-page change
// REPLACES the history entry — the Library stays one entry, so back from a detail restores the
// exact filtered state and back from the Library exits in one press. This screen is the viewer's
// own shelf (queries hard-filter owner); friends' shared patterns live in /friends.
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { LayoutGrid, Rows3 } from 'lucide-react'
import { usePatterns, useTags } from '../features/patterns/queries.ts'
import { useFinishedPatternIds } from '../features/projects/queries.ts'
import {
  EMPTY_FILTERS,
  hasAnyQuery,
  parseLibraryParams,
  serializeLibraryParams,
} from '../features/patterns/urlParams.ts'
import type { LibraryFilters, LibraryParams, LibraryView } from '../features/patterns/urlParams.ts'
import { ActiveFilterChips } from '../features/patterns/components/ActiveFilterChips.tsx'
import type { FilterGroup } from '../features/patterns/components/ActiveFilterChips.tsx'
import { EmptyState } from '../features/patterns/components/EmptyState.tsx'
import { FilterSheet } from '../features/patterns/components/FilterSheet.tsx'
import { PatternCard } from '../features/patterns/components/PatternCard.tsx'
import { SearchBar } from '../features/patterns/components/SearchBar.tsx'

function ViewToggle({ view, onChange }: { view: LibraryView; onChange: (v: LibraryView) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Layout">
      <button
        type="button"
        role="radio"
        aria-checked={view === 'grid'}
        aria-label="Grid view"
        className={`btn btn-square btn-ghost size-11 ${view === 'grid' ? 'btn-active' : ''}`}
        onClick={() => onChange('grid')}
      >
        <LayoutGrid size={22} strokeWidth={2} />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === 'list'}
        aria-label="List view"
        className={`btn btn-square btn-ghost size-11 ${view === 'list' ? 'btn-active' : ''}`}
        onClick={() => onChange('list')}
      >
        <Rows3 size={22} strokeWidth={2} />
      </button>
    </div>
  )
}

export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseLibraryParams(searchParams), [searchParams])
  const { filters, view } = params

  const patternsQuery = usePatterns(filters)
  const finishedQuery = useFinishedPatternIds()
  const tagsQuery = useTags()
  const [sheetOpen, setSheetOpen] = useState(false)

  const update = useCallback(
    (next: LibraryParams) => {
      setSearchParams(serializeLibraryParams(next), { replace: true })
    },
    [setSearchParams],
  )

  const commitSearch = useCallback(
    (q: string) => update({ ...params, filters: { ...params.filters, q } }),
    [params, update],
  )

  const applyFilters = (next: LibraryFilters) => update({ ...params, filters: next })

  const removeFilter = (group: FilterGroup, value: string) => {
    update({
      ...params,
      filters: { ...filters, [group]: filters[group].filter((v: string) => v !== value) },
    })
  }

  const clearAll = () => update({ ...params, filters: EMPTY_FILTERS })

  const patterns = patternsQuery.data ?? []
  const made = finishedQuery.data ?? new Set<string>()
  const filtering = hasAnyQuery(filters)

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 flex flex-col gap-2.5 bg-base-200 px-5 pt-1 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar value={filters.q} onCommit={commitSearch} />
          </div>
          <ViewToggle view={view} onChange={(v) => update({ ...params, view: v })} />
        </div>
        <ActiveFilterChips
          filters={filters}
          tags={tagsQuery.data ?? []}
          onOpenSheet={() => setSheetOpen(true)}
          onRemove={removeFilter}
        />
      </div>

      {patternsQuery.isPending ? (
        <div className="grid grid-cols-2 gap-4 px-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-box overflow-hidden bg-base-100">
              <div className="skeleton aspect-[4/5] w-full rounded-none" />
              <div className="flex flex-col gap-2 p-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : patternsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            The library couldn't load — try again in a moment?
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => void patternsQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : patterns.length === 0 ? (
        filtering ? (
          <EmptyState kind="search" onClearAll={clearAll} />
        ) : (
          <EmptyState kind="library" />
        )
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 px-5 sm:grid-cols-3 lg:grid-cols-4">
          {patterns.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} made={made.has(pattern.id)} view="grid" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {patterns.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} made={made.has(pattern.id)} view="list" />
          ))}
        </div>
      )}

      <FilterSheet
        open={sheetOpen}
        filters={filters}
        onApply={applyFilters}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
