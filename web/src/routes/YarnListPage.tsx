// web/src/routes/YarnListPage.tsx — the stash (/yarn, ADDONS §2.3): Library tabs, sticky
// search + weight filters in URL params, photo grid, and its own add door ("+ Add yarn" — the
// dock ➕ stays pattern-doors-only). Every in-page change REPLACES the history entry like the
// Library, so back from a yarn detail restores the exact filtered state. This is the viewer's
// own stash; friend-shared yarns surface via project chips and the picker instead.
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Plus, SlidersHorizontal, X } from 'lucide-react'
import { CYC_LABELS } from '../lib/cyc.ts'
import type { YarnWeight } from '../lib/schema.ts'
import { useYarns } from '../features/yarn/queries.ts'
import {
  countActiveYarnFilters,
  hasAnyYarnQuery,
  parseYarnParams,
  serializeYarnParams,
} from '../features/yarn/urlParams.ts'
import type { YarnFilters } from '../features/yarn/urlParams.ts'
import { YarnCard } from '../features/yarn/components/YarnCard.tsx'
import { YarnEmptyState } from '../features/yarn/components/YarnEmptyState.tsx'
import { YarnFilterSheet } from '../features/yarn/components/YarnFilterSheet.tsx'
import { SearchBar } from '../features/patterns/components/SearchBar.tsx'
import { LibraryTabs } from '../components/LibraryTabs.tsx'

function WeightChips({
  filters,
  onOpenSheet,
  onRemove,
}: {
  filters: YarnFilters
  onOpenSheet: () => void
  onRemove: (value: YarnWeight) => void
}) {
  const count = countActiveYarnFilters(filters)
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-0.5">
      <button
        type="button"
        onClick={onOpenSheet}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold"
        style={{
          background: 'var(--color-base-100)',
          color: 'var(--color-base-content)',
          borderColor: 'var(--color-base-300)',
        }}
      >
        <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
        Filters
        {count > 0 && (
          <span
            className="grid size-5 place-items-center rounded-full text-xs font-bold"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}
          >
            {count}
          </span>
        )}
      </button>

      {filters.weight.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`Remove filter: ${CYC_LABELS[value]}`}
          onClick={() => onRemove(value)}
          className="flex h-11 shrink-0 items-center gap-1 rounded-full border-[1.5px] px-3 text-sm font-semibold"
          style={{
            background: 'var(--patch-blue-soft)',
            color: 'var(--patch-blue-deep)',
            borderColor: 'var(--patch-blue-deep)',
          }}
        >
          {CYC_LABELS[value]}
          <X size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

export default function YarnListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseYarnParams(searchParams), [searchParams])

  const yarnsQuery = useYarns(filters)
  const [sheetOpen, setSheetOpen] = useState(false)

  const update = useCallback(
    (next: YarnFilters) => {
      setSearchParams(serializeYarnParams(next), { replace: true })
    },
    [setSearchParams],
  )

  const commitSearch = useCallback((q: string) => update({ ...filters, q }), [filters, update])

  const yarns = yarnsQuery.data ?? []
  const filtering = hasAnyYarnQuery(filters)

  return (
    <div className="flex flex-col gap-4">
      <LibraryTabs />

      {/* Sticky bars sit at the visual top once scrolled — in standalone PWA mode that is the
          notch/status bar, so the top inset pads here too (4.2, DESIGN §12 #3). */}
      <div
        className="sticky top-0 z-20 flex flex-col gap-2.5 bg-base-200 px-5 pb-2.5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.25rem)' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar
              value={filters.q}
              onCommit={commitSearch}
              placeholder="Search your stash"
              ariaLabel="Search your stash"
            />
          </div>
          <Link
            to="/yarn/new"
            aria-label="Add yarn"
            className="btn btn-primary btn-circle size-11 shrink-0"
          >
            <Plus size={24} strokeWidth={2.5} />
          </Link>
        </div>
        <WeightChips
          filters={filters}
          onOpenSheet={() => setSheetOpen(true)}
          onRemove={(value) =>
            update({ ...filters, weight: filters.weight.filter((v) => v !== value) })
          }
        />
      </div>

      {yarnsQuery.isPending ? (
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
      ) : yarnsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Your stash couldn't load. Try again in a moment?
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => void yarnsQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : yarns.length === 0 ? (
        filtering ? (
          <YarnEmptyState kind="search" onClearAll={() => update({ q: '', weight: [] })} />
        ) : (
          <YarnEmptyState kind="stash" />
        )
      ) : (
        <div className="grid grid-cols-2 gap-4 px-5 sm:grid-cols-3 lg:grid-cols-4">
          {yarns.map((yarn) => (
            <YarnCard key={yarn.id} yarn={yarn} />
          ))}
        </div>
      )}

      <YarnFilterSheet
        open={sheetOpen}
        filters={filters}
        onApply={(next) => update(next)}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
