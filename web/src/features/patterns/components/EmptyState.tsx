// web/src/features/patterns/components/EmptyState.tsx — the Library's two distinct empties
// (an acceptance criterion): brand-new shelf vs. filters-found-nothing. Whimsy lives here
// (DESIGN §11); copy for the empty library is verbatim from DESIGN.
import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { YarnBall } from '../../../components/YarnBall.tsx'

export function EmptyState({
  kind,
  onClearAll,
}: {
  kind: 'library' | 'search'
  onClearAll?: () => void
}) {
  if (kind === 'library') {
    return (
      <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
        <YarnBall size={96} />
        <p className="font-display max-w-60 text-xl font-bold">
          No patterns yet — your shelf is ready when you are.
        </p>
        <Link to="/patterns/new" className="btn btn-primary btn-lg">
          Add your first pattern
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
      <SearchX size={48} strokeWidth={2} style={{ color: 'var(--ink-muted)' }} aria-hidden="true" />
      <p className="font-display max-w-60 text-xl font-bold">
        Nothing matches, yet — try loosening a filter.
      </p>
      {onClearAll && (
        <button type="button" className="btn btn-ghost" onClick={onClearAll}>
          Clear search & filters
        </button>
      )}
    </div>
  )
}
