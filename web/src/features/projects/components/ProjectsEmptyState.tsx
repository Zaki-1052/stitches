// web/src/features/projects/components/ProjectsEmptyState.tsx — the projects list's two empties,
// mirroring the Library's (an acceptance pattern from 1.2): brand-new basket vs. a status filter
// that found nothing. Empty-basket copy is verbatim from DESIGN §11.
import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { YarnBall } from '../../../components/YarnBall.tsx'

export function ProjectsEmptyState({
  kind,
  onClear,
}: {
  kind: 'empty' | 'filtered'
  onClear?: () => void
}) {
  if (kind === 'empty') {
    return (
      <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
        <YarnBall size={96} />
        <p className="font-display max-w-60 text-xl font-bold">Nothing on the hook. Chain on!</p>
        <Link to="/projects/new" className="btn btn-primary btn-lg">
          Start a project
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
      {onClear && (
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          Show every status
        </button>
      )}
    </div>
  )
}
