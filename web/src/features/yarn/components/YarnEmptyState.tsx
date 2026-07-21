// web/src/features/yarn/components/YarnEmptyState.tsx — the stash's two distinct empties,
// mirroring the Library's (an acceptance criterion there, same principle here): brand-new
// basket vs. filters-found-nothing. Stash copy approved with the p14 plan; the search-empty
// line reuses the Library's approved copy verbatim per ADDONS §2.5.
import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { YarnBall } from '../../../components/YarnBall.tsx'

export function YarnEmptyState({
  kind,
  onClearAll,
}: {
  kind: 'stash' | 'search'
  onClearAll?: () => void
}) {
  if (kind === 'stash') {
    return (
      <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
        <YarnBall size={96} />
        <p className="font-display max-w-60 text-xl font-bold">
          No yarn yet. Your basket is ready when you are.
        </p>
        <Link to="/yarn/new" className="btn btn-primary btn-lg">
          Add your first yarn
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
      <SearchX size={48} strokeWidth={2} style={{ color: 'var(--ink-muted)' }} aria-hidden="true" />
      <p className="font-display max-w-60 text-xl font-bold">
        Nothing matches, yet. Try loosening a filter.
      </p>
      {onClearAll && (
        <button type="button" className="btn btn-ghost" onClick={onClearAll}>
          Clear search & filters
        </button>
      )}
    </div>
  )
}
